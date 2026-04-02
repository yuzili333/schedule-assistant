import serverless from "serverless-http";
import { createAgentServiceApp } from "../../src/server";

const handler = serverless(createAgentServiceApp());

export { handler };
