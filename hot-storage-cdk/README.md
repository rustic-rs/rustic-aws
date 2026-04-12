# S3 hot storage append-only backups  #

This is a [CDK application](https://docs.aws.amazon.com/cdk/v2/guide/home.html) that creates AWS infrastructure for [*rustic*](https://rustic.cli.rs) to back up data to [Amazon S3](https://aws.amazon.com/s3/) in append-only mode.

Append-only mode protects against cloud credentials getting leaked and misused to delete your data.

The CDK application creates the following resources in AWS:

* a hot storage S3 bucket;
* an IAM user for *rustic* to gain access to the bucket.

To the best of my knowledge, there is no financial cost for the existence of these resources; only for the usage.

Once the CDK application is deployed, you'll provide the resource names and credentials to *rustic*.

## setup

Prerequisites:

* NodeJS and npm on your computer;
* an AWS account;
* [CDK bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html);
* preferred AWS region set;
* an AWS [credential provider](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html) loaded with credentials for deploying CDK applications.

### 0. start configuration file(s)

#### stack name

This CDK will create a single CloudFormation stack.
This stack's name is your documentation for what purpose this serves in your account.
The default stack name is "rustic-backups".
This is a generic name, and I encourage you to customize it for your device or purpose, especially if you foresee deploying multiple instances of this stack to the same account.
The stack name cannot be changed once created.

To update the stack name, edit file://cdk.json `.context.stack-name`.

#### *rustic* configuration file

This CDK application creates AWS resources that you'll need to set in your [*rustic* configuration file](https://rustic.cli.rs/docs/commands/init/configuration_file.html).

An example configuration:

```toml
[repository]
repository = "opendal:s3"
repo-hot = "opendal:s3"
password = "my-password"                                 <-- change this
no-cache = true

[repository.options]
endpoint = "s3.dualstack.us-west-2.amazonaws.com"        <-- based on which region you deploy this CDK app to
region = "us-west-2"                                     <-- based on which region you deploy this CDK app to
bucket = "rustic-backups-bucket43879c71-igivajqocj1p"    <-- this CDK app creates the bucket name
default_storage_class = "GLACIER_IR"                     <-- up to you, but Instant Retrieval is a good default

[[backup.snapshots]]                                     <-- customize this section
name = "home-dir"
sources = ["/home"]
```

In this example, the AWS credentials are set outside of this configuration file. You can alternately set them in this configuration file directly.
Refer to the [s3-specific example here](https://github.com/rustic-rs/rustic/blob/main/config/services/s3_aws.toml) and [opendal configuration](https://opendal.apache.org/docs/rust/opendal/services/struct.S3.html) for more S3-specific options.

### 1. create AWS resources

Initialize the package:

    npm install

Build the package:

    npm run build

Then deploy:

    npm run cdk deploy

This will have created the CloudFormation stack with all the resources in your AWS account.

Once deployment succeeded, create an access key for the IAM user that *rustic* will use:

1. Log into the AWS console
1. Find the CloudFormation stack, and within its Resources list, find the IAM user with "user" logical ID. Open the IAM user.
1. Open "Security credentials" tab
1. In "Access keys" section, create access key.
1. Copy the *access key ID* and *secret access key* into the *rustic* config file or AWS credential provider of your choice.

### 2. use the AWS resources

Find the AWS resources created by the CDK: return to the stack in the AWS console, and open its Resources list.

Copy the resource IDs, ARNs, or URLs to your config file as described above.

Now you can back up your data and restore it. Verify that both work.

## maintenance

Once you deploy this CDK app to your account, it will exist there and maintain its resources forever, until you update or delete it.

This software package is versioned by a date in the stack description. (Visible in the AWS console.)

Periodically, there may be exciting updates to this CDK app.
To keep your stack updated, you can periodically `git pull` and `cdk deploy` the newest version.
Any changes that break backward compatibility will be called out in this README.

## decommission

To delete this CDK application from your AWS account, empty the S3 bucket first, else stack deletion will fail.
Once the bucket are empty, delete the CloudFormation stack.

Alternately, don't empty your bucket if you want to keep it.
Delete this stack; CloudFormation will delete what it can but leave the bucket.
At that point, you can retain the bucket and finish deleting the stack.
