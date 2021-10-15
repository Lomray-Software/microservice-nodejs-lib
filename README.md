# Microservice NodeJS library

Package for create microservice architecture based on [Ijson job server](https://github.com/lega911/ijson).   
All requests are made through `JSON-RPC 2.0`

### This package includes instruments for creating:
- Gateways
- Microservices

### Installation:
```bash
npm i --save @lomray/microservice-nodejs-lib
```

### Example
Go to `example` folder and check out the example of creating __microservice__ and __gateway__.
See `example/scratch.http` for understanding how to send requests.

1. install dependencies: `npm ci`
2. run ijson: `docker-compose up`
3. run 2 microservices - gateway & demo microservice: `node --require ts-node/register example/index.ts`

### How it works
![Diagram](example/diagram.png?raw=true "Diagram")
