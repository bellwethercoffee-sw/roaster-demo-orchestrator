import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import * as AWS from "@aws-sdk/client-lightsail";
import {v4 as uuidv4} from 'uuid';


dotenv.config();

const app: Express = express();
const port = process.env.PORT;
const lightsail = new AWS.Lightsail({ region: "us-east-1" });
const uuid = uuidv4();

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server is Running');
});

app.get('/create-instance', (req: Request, res: Response) => {
  res.send('Create Instance');
  createContainerService()
});

function listInstances(){
  console.log("List LS Instances "+uuid)

  const params = {
    serviceName: 'roaster-app-demo-service'
  };
  lightsail.getContainerServices(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
  });
}

function createContainerService(){
  var params = {
    power: 'micro', //nano | micro | small | medium | large | xlarge, /* required */
    scale: 1, /* required */
    serviceName: `roaster-app-demo-service-xyz`, /* required */
    deployment: {
      containers: {
        'roaster-app-demo-service-xyz': {
          // command: [
          //   'STRING_VALUE',
          //   /* more items */
          // ],
          environment: {
            'PORT': '8000'
          },
          image: '025870537499.dkr.ecr.us-east-1.amazonaws.com/roaster-app:web-demo-4d5ec03',
          ports: {
            '8000': 'HTTP'
          }
        },
        /* '<ContainerName>': ... */
      },
      publicEndpoint: {
        containerName: 'roaster-app-demo-service-xyz', /* required */
        containerPort: 8000, /* required */
        healthCheck: {
          healthyThreshold: 2,
          intervalSeconds: 5,
          path: '/',
          successCodes: '200-499',
          timeoutSeconds: 2,
          unhealthyThreshold: 2
        }
      }
    },
    privateRegistryAccess: {
      ecrImagePullerRole: {
        isActive: true
      }
    },
    tags: [
      {
        key: 'type',
        value: 'ochestrator'
      },
      /* more items */
    ]
  };
  lightsail.createContainerService(params, function(err: { stack: any; }, data: any) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
  });
}

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
  listInstances()
});
