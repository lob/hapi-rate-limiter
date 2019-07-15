#### 3.0.1 (2019-07-15)

##### Bug Fixes

* **timer:**  measures time taken more accurately ([#33](https://github.com/lob/hapi-rate-limiter/pull/33)) ([0f6131bf](https://github.com/lob/hapi-rate-limiter/commit/0f6131bfac8ff3533bd96533ddb7bcdc76f2655d))

## 3.0.0 (2019-06-17)

##### New Features

* **timer:**  adds timer option and simplifies key option names ([#32](https://github.com/lob/hapi-rate-limiter/pull/32)) ([275786a5](https://github.com/lob/hapi-rate-limiter/commit/275786a5cfb31863f3ddbb4c055f58fc46489b7f))
  * `rateLimitKey` is now named `key`
  * `rateLimitKeyPrefix` is now named `keyPrefix`
  * `timer` is a callback that is called with the elapsed milliseconds of
    the rate limit operation

### 2.2.0 (2018-12-13)

##### Bug Fixes

* **redis:**  handle redis error and continue the request ([0b06f486](https://github.com/lob/hapi-rate-limiter/commit/0b06f486d717ab32d12b7bf61aa62d53352714e8))

#### 2.1.1 (2018-07-12)

##### Bug Fixes

* **dependencies:**  Update Hapi peer dependency to reflect reality. ([#29](https://github.com/lob/hapi-rate-limiter/pull/29)) ([a8793798](https://github.com/lob/hapi-rate-limiter/commit/a8793798c12405048e860c89c43eab9518ba2c1b))

### 2.1.0 (2017-7-5)

##### New Features

* **key:** add a rateLimitKeyPrefix option so that rate limits can be common across routes ([178b0762](https://github.com/lob/hapi-rate-limiter/commit/178b07626beb879b4bf100fdd0fcb20ab1a331d4))

## 2.0.0 (2017-2-21)

##### Chores

* **readme:** updates README to match new interface ([eb72133b](https://github.com/lob/hapi-rate-limiter/commit/eb72133bd042f917e8a931612ea4180546be0a36))

## 1.0.0 (2016-11-9)

##### Bug Fixes

* **ttl:** fixes key expiration race condition ([e4e9adad](https://github.com/lob/hapi-rate-limiter/commit/e4e9adad37f0b1dceced19039bb52b726ceafd5b))

### 0.7.0 (2016-10-24)

##### Chores

* **redis:** remove dependence on then-redis ([30cf3e7d](https://github.com/lob/hapi-rate-limiter/commit/30cf3e7d7a2e666b23a806f3bc4e7cbf35914907))

#### 0.6.1 (2016-9-26)

##### Chores

* **dep:** updates peer dependency versioning ([cb2e0740](https://github.com/lob/hapi-rate-limiter/commit/cb2e0740b0274759beeb1c479a5e73db1a8a4cc4))

### 0.6.0 (2016-9-19)

##### New Features

* **rateLimitKey:** Allows endpoint specification of the rateLimitKey function ([162e1a8f](https://github.com/lob/hapi-rate-limiter/commit/162e1a8f536e840e522dbcb9944d18cc1932feed))

##### Bug Fixes

* **documentation:** update README to latest plugin name ([fd98fe0e](https://github.com/lob/hapi-rate-limiter/commit/fd98fe0e355486fd1932353cfca6259ca9eb3b90))

### 0.5.0 (2016-8-10)

##### New Features

* **key:** generalized account key func ([3f4b8ef3](https://github.com/lob/hapi-rate-limit/commit/3f4b8ef3dfa6c9455093a79c3ae9b419ee994309))

### 0.4.0 (2016-8-5)

##### New Features

* **headers:** added header + rename ([8616ebfd](https://github.com/lob/hapi-rate-limit/commit/8616ebfd4a3668515ec41d05f7422df73d309cec))

##### Refactors

* **peerDeps:** downgraded peer-dependencies ([5aef52fa](https://github.com/lob/hapi-rate-limit/commit/5aef52fa2f63f549de50b799ed33c351cce93092))

### 0.3.0 (2016-8-1)

##### New Features

* **default:** added deaulting ([44fc2673](https://github.com/lob/hapi-rate-limit/commit/44fc267354033d97acbb86d302aa40e7140646a4))

### 0.2.0 (2016-7-25)

##### New Features

* **rate:** rate to a function ([adece2c8](https://github.com/lob/hapi-rate-limit/commit/adece2c8e8f6a2cf8666820feb3158d444aaf87f))

#### 0.1.1 (2016-7-22)

##### Refactors

* **name:** changed name ([3b74cf7f](https://github.com/lob/hapi-rate-limit/commit/3b74cf7fe99f79230c16191875f8b849914902a8))

### 0.1.0 (2016-7-22)

##### New Features

* **api_key:** abstracted getter for api_key ([4189a2f5](https://github.com/lob/hapi-rate-limit/commit/4189a2f5cd623db8b46d75ef6a7cd7428ac30dd5))
* **readme:** updated README ([9a7941fe](https://github.com/lob/hapi-rate-limit/commit/9a7941fe8f0c34b916a0634f0dc355e313477e11))
* **headers:** sets headers on response object ([04fa8a2f](https://github.com/lob/hapi-rate-limit/commit/04fa8a2f2904da1ea016b4383a7174213be90a96))
* **ratelimiter:** added ratelimiter ([ddd6d788](https://github.com/lob/hapi-rate-limit/commit/ddd6d788488c6d3bb30fac484c617ac124513e8e))
* **setup:** initial setup for plugin ([c3b6d4f5](https://github.com/lob/hapi-rate-limit/commit/c3b6d4f56dcbc60d70fbd407648ff30efdb42781))

