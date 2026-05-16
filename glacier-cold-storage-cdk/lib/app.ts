import { App, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

import { APP_VERSION } from "./version.js";

class ArchiveStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const hotBucket = new s3.Bucket(this, "hot-bucket", {
      enforceSSL: true,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: false,
    });

    const coldBucket = new s3.Bucket(this, "cold-bucket", {
      enforceSSL: true,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(1),
          // This transition is probably not necessary since rustic
          // sets the storage class explicitly.
          transitions: [
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: Duration.days(0),
            },
          ],
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: false,
    });

    const batchManifestsBucket = new s3.Bucket(this, "batch-manifests-bucket", {
      enforceSSL: true,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(1),
          expiration: Duration.days(1),
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: false,
    });

    const batchReportsBucket = new s3.Bucket(this, "batch-reports-bucket", {
      enforceSSL: true,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(1),
          expiration: Duration.days(366),
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: false,
    });

    const coldBucketEventsQueue = new sqs.Queue(this, "cold-events-queue", {});

    coldBucket.addEventNotification(
      s3.EventType.OBJECT_RESTORE_COMPLETED,
      new s3n.SqsDestination(coldBucketEventsQueue));

    const s3BatchOperationRole = new iam.Role(this, "s3-batch-role", {
      assumedBy: new iam.ServicePrincipal("batchoperations.s3.amazonaws.com"),
      inlinePolicies: {
        // https://docs.aws.amazon.com/AmazonS3/latest/userguide/batch-ops-iam-role-policies.html
        // section: "Restore objects: RestoreObject"
        allowS3: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                "s3:ListBucket",
              ],
              effect: iam.Effect.ALLOW,
              resources: [
                coldBucket.bucketArn,
              ],
            }),
            new iam.PolicyStatement({
              actions: [
                "s3:RestoreObject",
              ],
              effect: iam.Effect.ALLOW,
              resources: [
                `${coldBucket.bucketArn}/*`,
              ],
            }),
            new iam.PolicyStatement({
              actions: [
                "s3:GetObject",
                "s3:GetObjectVersion",
              ],
              effect: iam.Effect.ALLOW,
              resources: [
                `${batchManifestsBucket.bucketArn}/*`,
              ],
            }),
            new iam.PolicyStatement({
              actions: [
                "s3:PutObject"
              ],
              effect: iam.Effect.ALLOW,
              resources: [
                `${batchReportsBucket.bucketArn}/*`,
              ],
            }),
          ],
        }),
      },
    });

    const user = new iam.User(this, "user");
    user.attachInlinePolicy(new iam.Policy(this, "user-policy", {
      statements: [
        // for append-only data backups using rustic
        new iam.PolicyStatement({
          actions: ["s3:GetObject", "s3:PutObject"],
          effect: iam.Effect.ALLOW,
          resources: [
            `${coldBucket.bucketArn}/*`,
            `${hotBucket.bucketArn}/*`,
          ],
          sid: "AllowAppendData",
        }),
        new iam.PolicyStatement({
          actions: ["s3:ListBucket"],
          effect: iam.Effect.ALLOW,
          resources: [
            `${coldBucket.bucketArn}`,
            `${hotBucket.bucketArn}`,
          ],
          sid: "AllowListBucket",
        }),
        new iam.PolicyStatement({
          actions: ["s3:DeleteObject"],
          effect: iam.Effect.ALLOW,
          resources: [
            `${coldBucket.bucketArn}/locks/*`,
            `${hotBucket.bucketArn}/locks/*`,
          ],
          sid: "AllowDeleteLocks",
        }),

        // for S3 batch operations
        new iam.PolicyStatement({
          actions: ["s3:PutObject"],
          effect: iam.Effect.ALLOW,
          resources: [
            `${batchManifestsBucket.bucketArn}/*`,
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            "s3:ListBucket", // find the results object key
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            batchReportsBucket.bucketArn,
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            "s3:GetObject", // read the results to check job status
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            `${batchReportsBucket.bucketArn}/*`,
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            "s3:CreateJob",
            "s3:DescribeJob",
          ],
          effect: iam.Effect.ALLOW,
          resources: [
            Stack.of(this).formatArn({
              service: "s3",
              resource: "job",
              resourceName: "*",
            }),
          ],
        }),
        new iam.PolicyStatement({
          actions: ["iam:PassRole"],
          effect: iam.Effect.ALLOW,
          resources: [
            s3BatchOperationRole.roleArn,
          ],
        }),

        // for S3 notifications
        new iam.PolicyStatement({
          actions: [
            "sqs:DeleteMessage",
            "sqs:Get*",
            "sqs:List*",
            "sqs:ReceiveMessage",
          ],
          effect: iam.Effect.ALLOW,
          resources: [coldBucketEventsQueue.queueArn],
        }),
      ],
    }));
  }
}

const STACK_NAME_VAR_NAME = "stack-name";

const app = new App();

const stackName = app.node.tryGetContext(STACK_NAME_VAR_NAME)
  ?? (() => {throw new Error(`Did not find the '${STACK_NAME_VAR_NAME}' CDK context environment variable`)})();

new ArchiveStack(app, stackName, {
  description: `https://github.com/rustic-rs/rustic-aws/glacier-cold-storage-cdk | version ${APP_VERSION}`,
});

