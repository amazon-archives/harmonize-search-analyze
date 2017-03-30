# Harmonize, Search, and Analyze Loosely Coupled Datasets on AWS

This repository contains the source code of the
[Harmonize, Search, and Analyze Loosely Coupled Datasets on AWS](https://aws.amazon.com/blogs/big-data/harmonize-search-and-analyze-loosely-coupled-datasets-on-aws/)
blog post. It is a set of CloudFormation templates and tools
for deploying a data harmonization and search application
which uses sample data from the [Public Safety Open Data
Portal](https://publicsafetydataportal.org/all-data/).

Click this CloudFormation button to launch your own copy of the
sample application in the us-east-1 (N. Virginia) AWS region:

[![cloudformation-launch-stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/new?stackName=datasearch-blog&templateURL=https://s3.amazonaws.com/aws-bigdata-blog/artifacts/harmonize-search-analyze/infrastructure/master.yaml)

## Overview

This repository consist of a set of nested CloudFormation templates that deploy the
following:

- Infrastructure per the [ECS Reference
Architecture](https://github.com/awslabs/ecs-refarch-cloudformation)
(VPC, NAT Gateways, ALB, ECS Cluster)
- ECR repositories to store Docker images
- ECS service containing:
[Kibana](https://www.elastic.co/products/kibana),
[aws-es-kibana](https://github.com/santthosh/aws-es-kibana) AWS ES/Kibana
proxy,
 [NGNIX](https://nginx.org/) proxy and a data discovery web application
 to perform searches on the datasets
- A deployment pipeline using CodePipeline and CodeBuild. This pipeline is
  loosely based on the [ECS Reference Architecture: Continuous
  Deployment](https://github.com/awslabs/ecs-refarch-continuous-deployment).
- AWS Elasticsearch Service cluster
- EMR cluster with Jupyter notebooks

## Directory Structure
The project contains the following main directories:

    .
    |__ build               # project wide build make files and environment config
    |__ infrastructure      # cloudformation templates and emr bootstrap scripts
    |__ notebooks           # jupyter notebooks and associated source
    |__ services            # web search application container definitions and sources

## CloudFormation Template Descriptions

The CloudFormation templates below are included in this repository:

| Template | Description |
| --- | --- |
| [master.yaml](master.yaml) | This is the master template used to deploy the stack to CloudFormation. It uses nested templates to include the ECS Reference Architecture templates as well as the ones listed below. |
| [infrastructure/elasticsearch.yaml](infrastructure/elasticsearch.yaml) | Elasticsearch cluster that enforces AWS authentication. The cluster holds the data dictionary, indexed data and the Kibana dashboard configuration. |
| [infrastructure/jupyterspark.yaml](infrastructure/jupyterspark.yaml) | EMR cluster with Apache Spark and Jupyter Notebooks. Used to explore, clean, harmonize (transform), describe, save, and index multiple loosely coupled datasets. |
| [infrastructure/pipeline.yaml](infrastructure/pipeline.yaml) | Continuous deployment of the data discovery web application (see service template below) using CodePipeline and CodeBuild. The pipeline takes the source, builds the data discovery web application using CodeBuild, pushes the container images to ECR and deploys the service to the ECS cluster using CloudFormation. The template deploys ECR, CodePipeline, CodeBuild and associated IAM resources. |
| [infrastructure/service.yaml](infrastructure/service.yaml) | ECS service and task definition for the data discovery web application plus related IAM, CloudWatch and ALB resources. It is used to run the containers that form the search interface including: Kibana, aws-es-kibana, NGINX and the web application. It is instantiated from pipeline stack. |

## Data Discovery Web Application Description
The data discovery web application is powered by Docker containers running
in ECS. It is a JavaScript based interface that drives an
embedded Kibana dashboard.

Here is a description of each container in the service:

- **kibana**. Kibana version 5.1 (compatible with AWS Elasticsearch
5.1). A Kibana dashboard is embedded in the web application using
an iframe. The dashboard is used to visualize the aggregated data.
Additionally, Kibana is used to pass requests from the browser
to Elasticsearch.
- **aws-es-kibana**. The [AWS ES/Kibana
Proxy](https://github.com/santthosh/aws-es-kibana)
is used to make authenticated requests to the AWS
Elasticsearch Service. The proxy uses credentials from an [ECS task
role](http://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
to sign requests to Elasticsearch. The permissions associated with the
role provides restricts access to Elasticsearch. The Kibana container
is configured to point to this proxy which in turn adds authentication
and passes the requests to the Elasticsearch cluster created by the
CloudFormation stack.
- **webapp**. This is a JavaScript web interface used to encapsulate and
drive the Kibana dashboard. The interface dynamically displays search
widgets from dictionary data stored in Elasticsearch. The front-end
interface utilizes [Backbone.js](http://backbonejs.org/) to manage the
model, view and collection of search widgets. The application uses various
[Bootstrap](http://getbootstrap.com/css/) widgets for the user interface.
Requests to Elasticsearch from the web application are passed through
Kibana which serves as a pass-through to the Elasticsearch API. The
web application is served from an [Express](http://expressjs.com/)
web server process.
- **nginx**. An NGINX reverse web proxy used to provide a unified point
of management.  The ALB passes web requests to NGINX. In turn, the proxy
routes the requests to the *webapp* or *kibana* container based on the
URL path. The proxy is also used to rewrite URLs and can be used to
manage HTTP headers.

You can find the `Dockerfile` definition and related source/configuration
of each service under its own subdirectory in the [services](services)
directory of the project.

# How do I ...?

## Deploy Using My Own S3 Bucket

1. Modify the [master.yaml](master.yaml) template to point
to your own S3 bucket. Please note that the S3 bucket must have
[versioning](http://docs.aws.amazon.com/AmazonS3/latest/dev/Versioning.html)
enabled for CodePipeline to work. Additionally, the bucket must be in
the same region as the CloudFormation stack. The bucket and path are
configured by the `ArtifactBucket` and `ArtifactPrefix` variables under
the `Mappings` section of the template.
2. Modify the variables in the local build environment file:
[build/config.env](build/config.env). These variables control the build
environment and web application deployment. In specific, you should
modify the following variables:
     - `ENV_BUCKET_PATH`: point it to your own bucket and prefix merged
       together as the path to the artifacts (same as step 1)
     - `ENV_NAME`: make it the same as the `EnvironmentName` parameter
       used when launching the CloudFormation stack
     - `ENV_VERSION`: you should bump the version variable everytime you make
     changes to the web application source to cause a new ECS deployment
3. Upload the files to your S3 bucket. The [build](build) directory
under the root of the repo contains a `Makefile` that can be used to
build the artifacts and upload the files into your S3 bucket. It uses the
[aws cli](https://aws.amazon.com/cli/) to upload to S3. The `Makefile`
uploads a zip file (from `git archive`) of your local repository to S3
so you should commit any local changes before uploading.

To upload the files to your s3 bucket, issue the following commands
(from the root of the repository):

```shell
# git commit any pending changes in the local repo prior to upload
$ cd build
$ make upload # requires properly configured aws cli
```

## Build a Stand-Alone Version of the Web Application

The front-end part of the web application (html, JavaScript and css) can
be built and packaged so that it can be deployed separately in a different
web server. The application build environment and dependencies are managed
using [npm](https://www.npmjs.com/). Here are the commands to build it:

```shell
$ cd services/webapp
$ npm install
$ npm build
```

The application is built and bundled using
[webpack](https://webpack.github.io/). The output files of the build
process can be found in the `dist` directory. That includes the bundled
JavaScript and CSS files which can be added to your web application.

Please note that moving it to a
different web server may require configuring
[CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS)
and changing the `publicPath` variable in the webpack configuration file
([webpack.config.js](services/webapp/webpack.config.js)) to point
it to the right URL path in the web server.

## Run the Web Application on a Development Workstation

The data discovery web application can be
run on a development workstation using [Docker
Compose](https://docs.docker.com/compose/). The [services](services)
directory contains the files [Makefile](services/Makefile) and
[docker-compose.yml](services/docker-compose.yml) which are used to
run the containers locally. The `Makefile` serves as a wrapper to
`docker-compose` to setup the environment and build process.

This Docker Compose service points the local aws-es-kibana container to
the AWS Elasticsearch Service cluster. That requires the Elasticsearch
cluster created by the CloudFormation templates in this project to
be up and running. Additionally, you need the aws cli configured with
credentials having permissions to obtain the Elasticsearch endpoint from
CloudFormation and to make requests to the Elasticsearch cluster.

If the CloudFormation stack was deployed to a region different than the
default one (us-east-1), you should set the `AWS_DEFAULT_REGION` variable
in the [build/config.env](build/config.env) file to the right AWS region.

The local development environment runs the web application using
[webpack-dev-server](https://webpack.github.io/docs/webpack-dev-server.html)
from the *webapp* container. It mounts the
*webapp* source directory from the host to allow
[hot-module-replacement](https://webpack.github.io/docs/hot-module-replacement.html).
Depending on your Docker configuration, you may need to configure Docker
so that the `webapp` directory is available to be mounted by containers
and point the `WEBAPP_DIR` environment variable to the directory.

To run the discovery web application on a workstation, issue the
following commands:

```shell
$ cd services
$ make up
```

## Cleanup the CloudFormation stacks?

The resources created in this environment can be easily removed
from your account by deleting the master CloudFormation
stack. The master stack (default stack name: datasearch-blog)
is the one that was first created using the "Launch Stack"
button. By deleting this stack, the rest of the sub-stacks will be
deleted as well. Some of the nested sub-stacks use CloudFormation [Custom
Resources](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html)
to facilitate cleaning up the resources.

The environment retains the EMR logs S3 bucket in case you need
to troubleshoot it. You should manually remove this bucket if
you don't want to keep this data. The name of this bucket is:
`datasearch-blog-jupyterspark-<ID>` (assuming default stack name
was used).

## Contributing

Please [create a new GitHub
issue](https://github.com/awslabs/harmonize-search-analyze/issues/new)
for any feature requests, bugs, or documentation improvements.

Where possible, please also [submit a pull
request](https://help.github.com/articles/creating-a-pull-request-from-a-fork/)
for the change.

## License

Copyright 2011-2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

[http://aws.amazon.com/apache2.0/](http://aws.amazon.com/apache2.0/)

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
