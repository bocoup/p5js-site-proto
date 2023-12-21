# p5.js website prototype

This is a prototype for a potential rebuild of the p5.js website using a new tech stack based around [Astro](https://astro.build/). There are many unsanded corners here, the primary goal of this code is to prove out a few critical pieces of functionality.

This also includes a protoype for a faster, more accessible p5.js code embed and preview component. This prototype has basic functionality and no styling outside of that needed for the code editor area itself. See the code for this in [src/components/CodeEmbed/](src/components/CodeEmbed/).

## Setup

1. Ensure you have [yarn](https://yarnpkg.com/) and node 18 (or later) installed.
2. `$ yarn i`

## Running

### Development Build

```shellsession
$ yarn dev
```

The root page (`/index.html`) contains links to some useful page examples and the full generated reference.

### Production Build

The production build of the site uses tree-shaking and other optimizations. Performance testing is best done with this version.

```shellsession
$ yarn build
$ yarn preview
```

## Building References and Examples

The content in [src/pages/en/reference/](./src/pages/en/reference/) and [src/pages/en/examples/](./src/pages/en/examples/) is generated from content that lives in the p5.js repo and the p5.js website repo. These are done with:

```shellsession
$ yarn build:reference
$ yarn build:examples
```

The results of this are committed into the repo.

## Deploying

This repo contains [a GitHub Action](./.github/workflows/deploy.yml) to deploy to GitHub Pages. It is currently disabled to avoid triggering failed runs. You can re-enable it buy un-commenting these lines at the top of the file.

```yaml
# push:
#   branches: [main]
```
