import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage, Secret as sec } from "aws-cdk-lib/aws-ecs";
import { ApplicationMultipleTargetGroupsFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  SslPolicy,
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Role } from "aws-cdk-lib/aws-iam";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

import { Construct } from "constructs";

const prefix = "nkvi-test";
const vpcId = "vpc-f4c49293";
const memory_spec = 512;
const cpu_spec = 256;
export class EcsMultipleTargetGroupsCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 👇 Importing existing VPC and Public/Private Subnets using Import function
    const vpc = Vpc.fromLookup(this, "vpc", {
      vpcId,
    });

    // 👇 Importing existing hosted zone in route53 using lookup function
    // const zone = HostedZone.fromLookup(this, "Zone", {
    //   domainName: `${domainName}`,
    // });

    // Create a security group to provide a secure connection between the ALB and the containers
    const albSG = new SecurityGroup(this, "alb-SG", {
      vpc,
      allowAllOutbound: true,
      description: `${prefix}-ALB-SG`,
    });

    albSG.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "Allow https traffic");

    albSG.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "Allow http traffic");

    albSG.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(7007),
      "Allow traffic on port 7007"
    );

    albSG.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(11011),
      "Allow traffic on port 11011"
    );

    // Security groups to allow connections from the application load balancer to the fargate containers
    const ecsSG = new SecurityGroup(this, "ecs-SG", {
      vpc,
      allowAllOutbound: true,
      description: `${prefix}-ECS-SG`,
    });

    ecsSG.connections.allowFrom(
      albSG,
      Port.tcp(80),
      "Application load balancer"
    );

    ecsSG.connections.allowFrom(
      albSG,
      Port.tcp(11011),
      "Application load balancer"
    );

    ecsSG.connections.allowFrom(
      albSG,
      Port.tcp(7007),
      "Application load balancer"
    );

    // 👇 ECS cluster creation
    const cluster = new Cluster(this, "Cluster", {
      clusterName: `${prefix}`,
      vpc,
    });

    // const loadBalancer = new ApplicationLoadBalancer(this, "ECSLB", {
    //   loadBalancerName: `${prefix}`,
    //   vpc,
    //   securityGroup: albSG,
    //   internetFacing: true,
    // });

    // 👇 Deploy fargate to ECS
    const loadBalancedFargateService =
      new ApplicationMultipleTargetGroupsFargateService(this, "Service", {
        cluster,
        assignPublicIp: true,
        desiredCount: 1,
        serviceName: `${prefix}`,
        loadBalancers: [
          {
            name: `${prefix}`,
            publicLoadBalancer: true,
            // vpc,
            // securityGroup: albSG,
            // internetFacing: true,
            listeners: [
              {
                name: "listener-80",
                protocol: ApplicationProtocol.HTTP,
                port: 80,
              },
              {
                name: "listener-7007",
                protocol: ApplicationProtocol.HTTP,
                port: 7007,
              },
              {
                name: "listener-11011",
                protocol: ApplicationProtocol.HTTP,
                port: 11011,
              },
            ],
          },
        ],
        // Cpu: default: 256
        // memoryLimitMiB: default: 512
        // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs.FargateTaskDefinition.html
        memoryLimitMiB: memory_spec ? Number(memory_spec) : undefined,
        cpu: cpu_spec ? Number(cpu_spec) : undefined,
        taskImageOptions: {
          family: `${prefix}-ecs-taskdef`,
          image: ContainerImage.fromRegistry(
            `336939151867.dkr.ecr.ap-southeast-1.amazonaws.com/mutilple-ports-app:latest`
          ),
          containerPorts: [80, 7007, 11011],
          containerName: "app",
          executionRole: Role.fromRoleName(
            this,
            "exec-role",
            `ecsTaskExecutionRole`
          ),
          // secrets: {
          //   MONGO_OPLOG_URL: sec.fromSecretsManager(secret, "MONGO_OPLOG_URL"),
          //   MONGO_URL: sec.fromSecretsManager(secret, "MONGO_URL"),
          //   PORT: sec.fromSecretsManager(secret, "PORT"),
          //   ROOT_URL: sec.fromSecretsManager(secret, "ROOT_URL"),
          //   METRICS_RETENTION_DAYS: sec.fromSecretsManager(
          //     secret,
          //     "METRICS_RETENTION_DAYS"
          //   ),
          // },
        },
        targetGroups: [
          {
            containerPort: 80,
            listener: "listener-80",
          },
          {
            containerPort: 7007,
            listener: "listener-7007",
          },
          {
            containerPort: 11011,
            listener: "listener-11011",
          },
        ],
      });
  }
}
