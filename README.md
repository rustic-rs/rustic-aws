# rustic's AWS integrations #

This repository contains some integrations between [*rustic*](https://rustic.cli.rs) and [*Amazon Web Services (AWS)*](https://aws.amazon.com/).

* [hot-storage-cdk](./hot-storage-cdk): a CDK application that creates AWS resources for hot storage backups in S3. With hot storage backups, you can restore your backups immediately.

* [glacier-cold-storage-cdk](./glacier-cold-storage-cdk): a CDK application that creates AWS resources for [cold storage backups](https://rustic.cli.rs/docs/commands/init/cold_storage.html). Cold storage backups cost less than hot storage, but you must wait up to 12 hours between requesting your data and retrieving it.

If you have ideas for more integrations, please start a discussion or a PR.
