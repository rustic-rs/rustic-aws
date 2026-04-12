import { App, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

import { APP_VERSION } from "./version.js";

class HotBackupsStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "bucket", {
      enforceSSL: true,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      versioned: false,
    });

    const user = new iam.User(this, "user");
    user.attachInlinePolicy(new iam.Policy(this, "user-policy", {
      statements: [
        // for append-only data backups using rustic
        new iam.PolicyStatement({
          actions: ["s3:GetObject", "s3:PutObject"],
          effect: iam.Effect.ALLOW,
          resources: [
            `${bucket.bucketArn}/*`,
          ],
          sid: "AllowAppendData",
        }),
        new iam.PolicyStatement({
          actions: ["s3:ListBucket"],
          effect: iam.Effect.ALLOW,
          resources: [
            bucket.bucketArn,
          ],
          sid: "AllowListBucket",
        }),
        new iam.PolicyStatement({
          actions: ["s3:DeleteObject"],
          effect: iam.Effect.ALLOW,
          resources: [
            `${bucket.bucketArn}/locks/*`,
          ],
          sid: "AllowDeleteLocks",
        }),
      ],
    }));
  }
}

const STACK_NAME_VAR_NAME = "stack-name";

const app = new App();

const stackName = app.node.tryGetContext(STACK_NAME_VAR_NAME)
  ?? (() => {throw new Error(`Did not find the '${STACK_NAME_VAR_NAME}' CDK context environment variable`)})();

new HotBackupsStack(app, stackName, {
  description: `https://github.com/rustic-rs/rustic-aws/hot-storage-cdk | version ${APP_VERSION}`,
});

