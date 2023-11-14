import * as documentation from "documentation";
import fs from "fs/promises";
import matter from "gray-matter";
import { remark } from "remark";
import remarkMDX from "remark-mdx";

let fileContextToModuleMap = new Map();
let fileContextToSubmoduleMap = new Map();

const modulePathTree = {};

function getModulePath(doc) {
  let prefix = `./src/pages/en/reference`;
  const module = fileContextToModuleMap[doc.context.file]?.toLowerCase();
  const submodule = fileContextToSubmoduleMap[doc.context.file]?.toLowerCase();

  // Check if module exists
  if (!module) {
    console.warn(
      `Could not find module for file ${doc.context.file} in fileContextToModuleMap`
    );
    return prefix;
  }

  let path = `${prefix}/${module}`;

  // Add submodule to path if it exists
  if (submodule) {
    path += `/${submodule}`;
  }

  const pathWithFile = `${path.replace("./src/pages", "")}/${doc.name}`;

  // Create or update modulePathTree
  if (!modulePathTree[module]) {
    modulePathTree[module] = {};
  }

  if (submodule) {
    if (!modulePathTree[module][submodule]) {
      modulePathTree[module][submodule] = {};
    }
    modulePathTree[module][submodule][doc.name] = pathWithFile;
  } else {
    modulePathTree[module][doc.name] = pathWithFile;
  }

  return path;
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

  const transformedParams = doc.params
    .map((param) => {
      // Check if the necessary properties exist
      if (!param.description || !param.description.children || !param.type) {
        return null; // or some default value
      }

      // Extract the description text
      const descriptionText = param.description.children
        .map((child) =>
          child.children.map((textNode) => textNode.value).join("")
        )
        .join("");

      return {
        name: param.name,
        description: descriptionText,
        type: param.type.name ?? param.type.expression.name,
      };
    })
    .filter((param) => param != null); // Filter out null values

  // console.log(transformedParams);

  // Create the frontmatter string
  const frontmatter = matter.stringify("", {
    title: doc.name,
    module,
    submodule,
    // This is currently a static value but might change
    layout: "@layouts/reference/SingleReferenceLayout.astro",
    params: transformedParams,
    // Add all properties as frontmatter, except for those that are objects
    // Likely needs to be organized more deliberately
    ...Object.entries(doc)
      .filter(
        ([key, value]) =>
          typeof value !== undefined && typeof value !== "object"
      )
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
    examples: doc.examples.map((example) => example.description),
  });

  // Combine all pieces of the doc into a single Markdown string
  let markdownContent = `# ${doc.name}\n`;

  // Process the Markdown content through remark and remark-mdx
  const mdxContent = remark().use(remarkMDX).processSync(markdownContent);

  // Combine frontmatter and MDX content
  return `${frontmatter}\n${mdxContent.toString()}`;
}

const getIndexMdx = () => {
  const frontmatter = matter.stringify("", {
    title: "Reference",
  });

  let markdownContent = `# Reference\n`;

  for (const module in modulePathTree) {
    markdownContent += `## ${module}\n`;
    const submodules = modulePathTree[module];

    // Check if the module has submodules
    if (Object.keys(submodules).length > 0 && typeof submodules === "object") {
      for (const submodule in submodules) {
        markdownContent += `### ${submodule}\n`;
        for (const docName in submodules[submodule]) {
          const path = submodules[submodule][docName];
          markdownContent += `- [${docName}](${path})\n`;
        }
      }
    } else {
      // Handling the case where the module has no submodules
      for (const docName in submodules) {
        const path = submodules[docName];
        markdownContent += `- [${docName}](${path})\n`;
      }
    }
  }

  const mdxContent = remark().use(remarkMDX).processSync(markdownContent);

  return `${frontmatter}\n${mdxContent.toString()}`;
};

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

  /* Save reference home for navigation */
  const indexMdx = getIndexMdx();
  await fs.writeFile(`./src/pages/en/reference/index.mdx`, indexMdx.toString());
}

main();
