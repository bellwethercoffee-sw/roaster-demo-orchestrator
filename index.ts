import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

// ----------LIGHTSAIL --------------
import * as AWS from "@aws-sdk/client-lightsail";
const lightsail = new AWS.Lightsail({ region: "us-east-1" });
// ----------END LIGHTSAIL --------------

dotenv.config();

const app: Express = express();
const port = process.env.PORT;

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server is Running');
});

// ----------LIGHTSAIL --------------
function listInstances(){
  console.log("List LS Instances")

  const params = {
    serviceName: 'roaster-app-demo-service'
  };
  lightsail.getContainerServices(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
  });
}
// ----------END LIGHTSAIL --------------

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
  listInstances()
});
