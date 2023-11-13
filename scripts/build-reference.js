import * as documentation from "documentation";
import fs from "fs/promises";
import matter from "gray-matter";
import { remark } from "remark";
import remarkMDX from "remark-mdx";

let fileContextToModuleMap = new Map();
let fileContextToSubmoduleMap = new Map();

function getModulePath(doc) {
  const prefix = `./pages/en/reference`;
  const module = fileContextToModuleMap[doc.context.file];
  if (!module) {
    console.warn(
      `Could not find module for file ${doc.context.file} in fileContextToModuleMap`
    );
    return prefix;
  }
  const submodule = fileContextToSubmoduleMap[doc.context.file];
  if (!submodule) {
    return `${prefix}/${module}`;
  }
  return `${prefix}/${module}/${submodule}/`;
}

function convertToMDX(doc) {
  for (const tag of doc.tags) {
    if (tag.title === "module") {
      // Store mapping of modules to their file path
      fileContextToModuleMap[doc.context.file] = tag.name;
    } else if (tag.title === "submodule") {
      // Store mapping of submodules to their parent module
      fileContextToSubmoduleMap[doc.context.file] = tag.description;
    }
  }

  const module = fileContextToModuleMap[doc.context.file];
  const submodule = fileContextToSubmoduleMap[doc.context.file];

  // This is the module declaration
  if (module === doc.name) {
    return;
  }

  // p5 keeps some internal modules that we don't want to document
  if (doc.name.startsWith("_")) {
    return;
  }

  // Create the frontmatter string
  const frontmatter = matter.stringify("", {
    title: doc.name,
    module,
    submodule,
    examples: doc.examples.map((example) => example.description),
    // Add all properties as frontmatter, except for those that are objects
    // Likely needs to be organized more deliberately
    ...Object.entries(doc)
      .filter(
        ([key, value]) =>
          typeof value !== undefined && typeof value !== "object"
      )
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
  });

  // Combine all pieces of the doc into a single Markdown string
  let markdownContent = `# ${doc.name}\n`;

  // Process the Markdown content through remark and remark-mdx
  const mdxContent = remark().use(remarkMDX).processSync(markdownContent);

  // Combine frontmatter and MDX content
  return `${frontmatter}\n${mdxContent.toString()}`;
}

async function main() {
  console.log("Building reference docs...");
  const docs = await documentation.build(["example-src/**/*.js"], {
    shallow: true,
  });
  for (const doc of docs) {
    const mdx = await convertToMDX(doc, matter, remark, remarkMDX);
    if (!mdx) {
      continue;
    }
    const savePath = getModulePath(doc);
    await fs.mkdir(savePath, {
      recursive: true,
    });
    await fs.writeFile(`${savePath}/${doc.name}.mdx`, mdx.toString());
  }
}

main();
