# Microservice NodeJS library

Package for create microservice architecture based on [Ijson job server](https://github.com/lega911/ijson).   
All requests are made through `JSON-RPC 2.0`

![npm](https://img.shields.io/npm/v/@lomray/microservice-nodejs-lib)
![GitHub](https://img.shields.io/github/license/Lomray-Software/microservice-nodejs-lib)

[![Quality Gate Status](https://sonarqube-proxy.lomray.com/status/Lomray-Software_microservice-nodejs-lib?token=e8287c0b621c488e0a9fac83cb53763a)](https://sonarqube.lomray.com/dashboard?id=Lomray-Software_microservice-nodejs-lib)
[![Reliability Rating](https://sonarqube-proxy.lomray.com/reliability/Lomray-Software_microservice-nodejs-lib?token=e8287c0b621c488e0a9fac83cb53763a)](https://sonarqube.lomray.com/dashboard?id=Lomray-Software_microservice-nodejs-lib)
[![Security Rating](https://sonarqube-proxy.lomray.com/security/Lomray-Software_microservice-nodejs-lib?token=e8287c0b621c488e0a9fac83cb53763a)](https://sonarqube.lomray.com/dashboard?id=Lomray-Software_microservice-nodejs-lib)
[![Vulnerabilities](https://sonarqube-proxy.lomray.com/vulnerabilities/Lomray-Software_microservice-nodejs-lib?token=e8287c0b621c488e0a9fac83cb53763a)](https://sonarqube.lomray.com/dashboard?id=Lomray-Software_microservice-nodejs-lib)
[![Lines of code](https://sonarqube-proxy.lomray.com/lines/Lomray-Software_microservice-nodejs-lib?token=e8287c0b621c488e0a9fac83cb53763a)](https://sonarqube.lomray.com/dashboard?id=Lomray-Software_microservice-nodejs-lib)
[![Coverage](https://sonarqube-proxy.lomray.com/coverage/Lomray-Software_microservice-nodejs-lib?token=e8287c0b621c488e0a9fac83cb53763a)](https://sonarqube.lomray.com/dashboard?id=Lomray-Software_microservice-nodejs-lib)

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
