# Plan 002 - Dockerfile

Create a Dockerfile at the root of the repository that builds the application and the takes the files in the `dist` directory and serves them.

The Dockerfile must be a multi-stage build that builds the app in the first stage and serves it in the second stage.

## Stage 1 - Building

The first stage of the Dockerfile must be based on the `node:24-alpine` image. It must run `npm install` then `npm build` to get the dev dependencies and then run TypeScript to compile the JS. After a successful build, it should move to the second stage.

## Stage 2 - Serving

The second stage of the Dockerfile must be based on the `nginx:alpine` image. It must copy the files from the `dist` directory that resulted from the build in stage 1 to the directory `/usr/share/nginx/html` in its own stage.

There is no need to change the entrypoint or command for the stage since the base image starts NGINX with the correct config by default.

## Bake File

To make building the image easier, there should be a `docker-bake.hcl` file at the repository root. It should build `Dockerfile` with a tag of `tomato-master`.
