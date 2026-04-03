# Glacier cold storage append-only backups  #

[*rustic*](https://rustic.cli.rs) is unique among data backup programs in supporting [cold storage](https://rustic.cli.rs/docs/commands/init/cold_storage.html).

This is a [CDK application](https://docs.aws.amazon.com/cdk/v2/guide/home.html) that creates AWS infrastructure for *rustic* to back up data to [Glacier cold storage](https://aws.amazon.com/s3/storage-classes/glacier/) (Glacier Deep Archive) in append-only mode.

Backing up to Glacier Deep Archive minimizes financial cost and is a great fit for the [3-2-1 backup strategy](https://www.backblaze.com/blog/the-3-2-1-backup-strategy/).
Append-only mode protects against cloud credentials getting leaked and misused to delete your data.

The CDK application creates the following resources in AWS:

* hot and cold storage S3 buckets, as required by *rustic* for cold storage support;
* a queue for restore-completed events, and the subscription for these events;
* an IAM user for *rustic* and *warmup-s3-archives* programs to share;
* two additional S3 buckets for batch operation management;
* an IAM role for batch-requesting restoration of packs.

To the best of my knowledge, there is no financial cost for the existence of any of these resources; only for the usage.

Once the CDK application is deployed, you'll provide the resource names and credentials to both *rustic* and to [*warmup-s3-archives*](https://gitlab.com/philipmw/warmup-s3-archives) programs.

## setup

Prerequisites:

* NodeJS and npm on your computer;
* an AWS account;
* [CDK bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html);
* preferred AWS region set;
* an AWS [credential provider](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html) loaded with credentials for deploying CDK applications.

### 0. start configuration file(s)

#### backup/warmup stack name

This CDK will create a single CloudFormation stack, which contains both the S3 buckets for your backups and the infrastructure to warm up and restore data from them.
This stack's name is your documentation for what purpose this serves in your account.
The default stack name is "rustic-cold-backups".
This is a generic name, and I encourage you to customize it for your device or purpose, especially if you foresee deploying multiple instances of this stack to the same account.
The stack name cannot be changed once created.

To update the stack name, edit file://cdk.json `.context.stack-name`.

#### *rustic* configuration file

This CDK application creates AWS resources that you'll need to set in your [*rustic* configuration file](https://rustic.cli.rs/docs/commands/init/cold_storage.html#configuring-storage-in-rustic-rustic-init). Start with the template documented there.

#### *s3-warmup-archives* configuration file

This CDK application creates AWS resources that you'll need to set in your [*warmup-s3-archives* configuration file](https://gitlab.com/philipmw/warmup-s3-archives/-/blob/main/warmup-s3-archives-config.sample.toml?ref_type=heads). Start with the template documented there.

### 1. create AWS resources

Initialize the package:

    npm install

Build the package:

    npm run build

Then deploy:

    npm run cdk deploy

This will have created the CloudFormation stack with all the resources in your AWS account.

Once deployment succeeded, create an access key for the IAM user that both *rustic* and *warmup-s3-archives* will use:

1. Log into the AWS console
1. Find the CloudFormation stack, and within its Resources list, find the IAM user with "user" logical ID. Open the IAM user.
1. Open "Security credentials" tab
1. In "Access keys" section, create access key.
1. Copy the *access key ID* and *secret access key* into the *rustic* config file. (For *s3-warmup-archives*, you'll need to provide it using an AWS CLI profile or environment variables.)

### 2. use the AWS resources

Find the AWS resources created by the CDK: return to the stack in the AWS console, and open its Resources list.

Copy the resource IDs, ARNs, or URLs to your config files as described above, both for backups and for the warmup workflow.

Now you can both back up your data to cold storage and restore it. Verify that both work.

## maintenance

Once you deploy this CDK app to your account, it will exist there and maintain its resources forever, until you update or delete it.

This software package is versioned by a date in the stack description. (Visible in the AWS console.)

Periodically, there may be exciting updates to this CDK app.
To keep your stack updated, you can periodically `git pull` and `cdk deploy` the newest version.
Any changes that break backward compatibility will be called out in this README.

## decommission

To delete this CDK application from your AWS account, empty all four S3 buckets first, else stack deletion will fail.
Once all four buckets are empty, delete the CloudFormation stack.

Alternately, don't empty your data buckets if you want to keep them.
Delete this stack; CloudFormation will delete what it can but leave the non-empty buckets.
At that point, you can retain those buckets and finish deleting the stack.
