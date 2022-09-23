# Microservice NodeJS library

Package for create microservice architecture based on [Ijson job server](https://github.com/lega911/ijson).   
All requests are made through `JSON-RPC 2.0`

![npm](https://img.shields.io/npm/v/@lomray/microservice-nodejs-lib)
![GitHub](https://img.shields.io/github/license/Lomray-Software/microservice-nodejs-lib)

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_microservice-nodejs-lib&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_microservice-nodejs-lib)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_microservice-nodejs-lib&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_microservice-nodejs-lib)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_microservice-nodejs-lib&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_microservice-nodejs-lib)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_microservice-nodejs-lib&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_microservice-nodejs-lib)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_microservice-nodejs-lib&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_microservice-nodejs-lib)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Lomray-Software_microservice-nodejs-lib&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Lomray-Software_microservice-nodejs-lib)

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
