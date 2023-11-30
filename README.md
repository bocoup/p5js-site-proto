# p5.js website prototype

This is a prototype for a potential rebuild of the p5.js website using a new tech stack based around [Astro](https://astro.build/). There are many unsanded corners here, the primary goal of this code is to prove out a few critical pieces of functionality.

## Setup

1. Ensure you have [yarn](https://yarnpkg.com/) and node 18 (or later) installed.
2. `$ yarn i`

## Running

`$ yarn dev`

See other commands available through the Astro CLI at https://docs.astro.build/en/reference/cli-reference/.

## Building References and Examples

The content in [src/pages/en/reference/](./src/pages/en/reference/) and [src/pages/en/examples/](./src/pages/en/examples/) is generated from content that lives in the p5.js repo and the p5.js website repo. These are done with:

```shellsession
$ yarn build:reference
$ yarn build:examples
```

The results of this are committed into the repo.
