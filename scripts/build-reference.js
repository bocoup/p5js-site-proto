import * as documentation from "documentation";
import { exec } from "child_process";
import { promisify } from "util";

import fs from "fs/promises";
import matter from "gray-matter";
import { remark } from "remark";
import remarkMDX from "remark-mdx";
import { simpleGit } from "simple-git";

let fileContextToModuleMap = new Map();
let fileContextToSubmoduleMap = new Map();

const localPath = "temp/p5.js";
const srcPath = "src/**/*.js";

const modulePathTree = {};

const execPromise = promisify(exec);

async function generateDocsFromJSDoc() {
  const options = {
    maxBuffer: 10 * 1024 * 1024,
  };

  try {
    const { stdout, stderr } = await exec(
      `jsdoc -X ${localPath}/${srcPath}`,
      options
    );
    if (stderr) {
      console.error("Error generating JSDoc:", stderr);
      return [];
    }
    return JSON.parse(stdout);
  } catch (error) {
    console.error("Error executing JSDoc command:", error);
    return [];
  }
}

function getModulePath(doc) {
  if (!doc) {
    return;
  }

  let prefix = `./src/pages/en/reference`;
  const module = fileContextToModuleMap[doc.meta.filename]?.toLowerCase();

  // Check if module exists
  if (!module) {
    console.warn(
      `Could not find module for file ${doc.meta.filename} in fileContextToModuleMap`
    );
    return prefix;
  }

  let path = `${prefix}/${module}`;

  const pathWithFile = `${path.replace("./src/pages", "")}/${doc.name}`;

  // Create or update modulePathTree
  if (!modulePathTree[module]) {
    modulePathTree[module] = {};
  }

  modulePathTree[module][doc.name] = pathWithFile;

  return path;
}

function convertToMDX(doc) {
  if (!doc || doc.kind === "package") {
    return;
  }
  console.log(doc);

  // for (const tag of doc.tags ?? []) {
  //   if (tag.title === "module") {
  //     // Store mapping of modules to their file path
  //     fileContextToModuleMap[doc.meta.filename] = tag.name;
  //   } else if (tag.title === "submodule") {
  //     // Store mapping of submodules to their parent module
  //     fileContextToSubmoduleMap[doc.meta.filename] = tag.description;
  //   }
  // }

  // const module = fileContextToModuleMap[doc.meta.filename];
  // let submodule = fileContextToSubmoduleMap[doc.meta.filename];

  if (doc.kind === "module") {
    return;
  }

  let module;
  if (doc.memberof) {
    module = doc.memberof.match(/module:([a-zA-Z0-9]+)(?:[#~]|$)/)?.[1] ?? "";
  }

  if (!module) {
    console.error(`Could not find module for ${doc.name}`);
    console.log(doc);
    return;
  }

  fileContextToModuleMap[doc.meta.filename] = module;

  // // Submodule is not useful when identical to module
  // // Should be cleaned up in authoring
  // if (submodule === module) {
  //   submodule = null;
  // }

  // // This is the module declaration, no reference needed
  // if (module === doc.name) {
  //   return;
  // }

  // p5 keeps some internal modules that we don't want to document
  if (doc.name?.startsWith("_")) {
    return;
  }

  const transformedParams =
    doc.params
      ?.map((param) => {
        // Check if the necessary properties exist
        if (
          !param.description ||
          !param.description.children ||
          (!param.type?.name && !param.type?.expression?.name)
        ) {
          return null;
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
          type: param.type.name ?? param.type?.expression?.name ?? "",
        };
      })
      .filter((param) => param != null) ?? [];

  let descriptionText = "";

  for (const child of doc.description?.children ?? []) {
    for (const textNode of child.children ?? []) {
      switch (textNode.type) {
        case "inlineCode":
          descriptionText += `\`${textNode.value}\``;
          break;
        case "link":
          descriptionText += `[${textNode.children[0].value}](${textNode.url})`;
          break;
        case "strong":
          descriptionText += `**${textNode.children[0].value}**`;
          break;
        case "emphasis":
          descriptionText += `*${textNode.children[0].value}*`;
          break;
        case "paragraph":
          descriptionText += `${textNode.children[0].value}`;
          break;
        case "text":
        default:
          descriptionText += textNode.value;
          break;
      }
    }
  }

  let frontMatterArgs = {};
  try {
    frontMatterArgs = {
      layout: "@layouts/reference/SingleReferenceLayout.astro",
      title: doc.name ?? "",
      module,
      file: doc.meta.filename.replace(/.*?(?=src)/, ""), // Get relative path from src
      // This is currently a static value but might change
      descriptionText,
      params: transformedParams,
      // Add all properties as frontmatter, except for those that are objects
      // This likely needs to be organized more deliberately
      ...Object.entries(doc)
        .filter(
          ([key, value]) =>
            typeof value !== "object" && typeof value !== "undefined"
        )
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),

      examples: doc.examples ?? [],
    };

    // Create the frontmatter string
    const frontmatter = matter.stringify("", frontMatterArgs);

    // Combine all pieces of the doc into a single Markdown string
    let markdownContent = `# ${doc.name}\n`;

    // Process the Markdown content through remark and remark-mdx
    const mdxContent = remark().use(remarkMDX).processSync(markdownContent);

    // Combine frontmatter and MDX content
    return `${frontmatter}\n${mdxContent.toString()}`;
  } catch (err) {
    console.error(`Error converting ${doc.name} to MDX: ${err}`);
    console.log(frontMatterArgs);
    return;
  }
}

const getIndexMdx = () => {
  const frontmatter = matter.stringify("", {
    title: "Reference",
  });

  let markdownContent = `# Reference\n`;
  for (const module in modulePathTree) {
    markdownContent += `## ${module}\n`;
    const submodules = modulePathTree[module];

    const scanAndAddSubmodules = (modules) => {
      for (const [key, val] of Object.entries(modules)) {
        if (key === "root") {
          continue;
        }
        if (typeof val === "object" && Object.keys(val).length > 0) {
          markdownContent += `### ${key}\n`;
          scanAndAddSubmodules(val);
        } else {
          markdownContent += `- [${key}](${val})\n`;
        }
      }
    };

    scanAndAddSubmodules(submodules);
  }

  const mdxContent = remark().use(remarkMDX).processSync(markdownContent);

  return `${frontmatter}\n${mdxContent.toString()}`;
};

async function cloneLibraryRepo() {
  const git = simpleGit();
  const repoUrl = "https://github.com/processing/p5.js.git";

  console.log("Cloning repository...");
  await git.clone(repoUrl, localPath, ["--depth", "1", "--filter=blob:none"]);
}

async function deleteClonedLibraryRepo(path) {
  try {
    await fs.rm(path, { recursive: true, force: true });
    console.log(`Deleted cloned library source code: ${path}`);
  } catch (err) {
    console.error(`Error deleting cloned library code: ${err}`);
  }
}

async function cleanUp() {
  await deleteClonedLibraryRepo("temp");
}

async function main() {
  // await cloneLibraryRepo();

  console.log("Building reference docs...");
  console.log(`${localPath}/${srcPath}`);

  const docs = await generateDocsFromJSDoc();
  if (!docs.length) {
    console.error("No documentation generated");
    return;
  }

  for (const doc of docs) {
    const mdx = await convertToMDX(doc, matter, remark, remarkMDX);

    if (!mdx) {
      console.log(`Skipping ${doc.name}...`);
      continue;
    }
    const savePath = getModulePath(doc);
    await fs.mkdir(savePath, {
      recursive: true,
    });
    await fs.writeFile(`${savePath}/${doc.name}.mdx`, mdx.toString());
  }

  /* Save reference home for navigation */
  // console.log("Saving reference index...");
  // const indexMdx = getIndexMdx();
  // await fs.writeFile(`./src/pages/en/reference/index.mdx`, indexMdx.toString());

  await deleteClonedLibraryRepo("temp");

  console.log("Done building reference docs!");
}

main();
