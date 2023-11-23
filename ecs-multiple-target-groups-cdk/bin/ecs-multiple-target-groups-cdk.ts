#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { EcsMultipleTargetGroupsCdkStack } from "../lib/ecs-multiple-target-groups-cdk-stack";

const app = new cdk.App();
new EcsMultipleTargetGroupsCdkStack(app, "EcsMultipleTargetGroupsCdkStack", {
  env: {
    region: "ap-southeast-1",
    account: "336939151867",
  },
});
