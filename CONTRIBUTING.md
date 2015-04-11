# Contributing

Contributions are always welcome, no matter how large or small. Before
contributing, please read the
[code of conduct](CODE_OF_CONDUCT.md).

## Developing

#### Setup

```sh
$ git clone https://github.com/dignifiedquire/ShareJS
$ cd ShareJS
$ npm install
```

#### Running tests

You can run tests via:

```sh
$ npm test
```

#### Workflow

* Fork the repository
* Clone your fork and change directory to it (`git clone git@github.com:yourUserName/ShareJS.git && cd ShareJS`)
* Install the project dependencies (`npm install`)
* Link your forked clone (`npm link`)
* Develop your changes ensuring you're fetching updates from upstream often
* Ensure the test are passing (`make test`)
* Create new pull request explaining your proposed change or reference an issue in your commit message

#### Code Standards

It's mostly [feross/standard](https://github.com/feross/standard) with some
deviations, see [`.eslintrc`](.eslintrc) for details. To ensure the code is good
run linting via `npm run lint`.
