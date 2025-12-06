import "colors";

// Box drawing characters
const BOX_CHARS = {
  horizontal: "─",
  vertical: "│",
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  cross: "┼",
  tLeft: "├",
  tRight: "┤",
  tTop: "┬",
  tBottom: "┴",
};

// Color scheme - colors library extends String prototype
export const colors = {
  primary: (text: string): string => (text as any).cyan || text,
  secondary: (text: string): string => (text as any).grey || text,
  success: (text: string): string => (text as any).green || text,
  warning: (text: string): string => (text as any).yellow || text,
  error: (text: string): string => (text as any).red || text,
  info: (text: string): string => (text as any).blue || text,
  accent: (text: string): string => (text as any).magenta || text,
  dim: (text: string): string => (text as any).dim || text,
  bold: (text: string): string => (text as any).bold || text,
};

// Create a box with content
export const createBox = (
  content: string | string[],
  options: {
    title?: string;
    color?: "primary" | "success" | "warning" | "error" | "info";
    padding?: number;
    width?: number;
  } = {},
): string => {
  const { title, color = "primary", padding = 1, width } = options;
  const lines = Array.isArray(content) ? content : content.split("\n");
  const maxLineLength = Math.max(
    ...lines.map((line) => stripColors(line).length),
    title ? stripColors(title).length + 2 : 0,
  );
  const boxWidth = width || maxLineLength + padding * 2 + 2;

  const colorFn = colors[color];
  const borderColor = colorFn;

  let result = "";
  
  // Top border
  if (title) {
    const titleText = ` ${title} `;
    const titleLength = stripColors(titleText).length;
    const leftPad = Math.floor((boxWidth - titleLength - 2) / 2);
    const rightPad = boxWidth - titleLength - 2 - leftPad;
    result += borderColor(
      BOX_CHARS.topLeft +
        BOX_CHARS.horizontal.repeat(leftPad) +
        titleText +
        BOX_CHARS.horizontal.repeat(rightPad) +
        BOX_CHARS.topRight,
    ) + "\n";
  } else {
    result +=
      borderColor(
        BOX_CHARS.topLeft + BOX_CHARS.horizontal.repeat(boxWidth - 2) + BOX_CHARS.topRight,
      ) + "\n";
  }

  // Content
  for (const line of lines) {
    const lineLength = stripColors(line).length;
    const paddingStr = " ".repeat(padding);
    const rightPad = boxWidth - lineLength - padding * 2 - 2;
    result +=
      borderColor(BOX_CHARS.vertical) +
      paddingStr +
      line +
      " ".repeat(rightPad) +
      paddingStr +
      borderColor(BOX_CHARS.vertical) +
      "\n";
  }

  // Bottom border
  result += borderColor(
    BOX_CHARS.bottomLeft + BOX_CHARS.horizontal.repeat(boxWidth - 2) + BOX_CHARS.bottomRight,
  );

  return result;
};

// Create a section divider
export const createDivider = (
  text?: string,
  color: "primary" | "success" | "warning" | "error" | "info" = "primary",
): string => {
  const width = process.stdout.columns || 80;
  const colorFn = colors[color];
  
  if (text) {
    const textLength = stripColors(text).length;
    const padding = Math.max(2, Math.floor((width - textLength - 4) / 2));
    const line =
      colorFn(BOX_CHARS.horizontal.repeat(padding)) +
      ` ${text} ` +
      colorFn(BOX_CHARS.horizontal.repeat(padding));
    return line;
  }
  
  return colorFn(BOX_CHARS.horizontal.repeat(width));
};

// Create a header
export const createHeader = (text: string, subtitle?: string): string => {
  const width = process.stdout.columns || 80;
  const title = colors.bold(colors.primary(`\n${text}`));
  const sub = subtitle ? colors.dim(`\n${subtitle}\n`) : "";
  return title + sub;
};

// Create a list item with bullet
export const createListItem = (
  text: string,
  bullet: string = "•",
  indent: number = 2,
): string => {
  return " ".repeat(indent) + colors.primary(bullet) + " " + text;
};

// Create a status badge
export const createBadge = (
  text: string,
  type: "success" | "warning" | "error" | "info" = "info",
): string => {
  const colorFn = colors[type];
  return colorFn(`[${text}]`);
};

// Strip ANSI color codes
const stripColors = (text: string): string => {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, "");
};

// Print a styled message
export const printMessage = (
  message: string,
  type: "success" | "warning" | "error" | "info" = "info",
): void => {
  const colorFn = colors[type];
  const badge = createBadge(type.toUpperCase(), type);
  console.log(badge + " " + message);
};

// Print a section
export const printSection = (
  title: string,
  content: string | string[],
  options: {
    color?: "primary" | "success" | "warning" | "error" | "info";
    padding?: number;
  } = {},
): void => {
  console.log("\n" + createBox(content, { title, ...options }) + "\n");
};

// Print welcome message
export const printWelcome = (title: string, subtitle?: string): void => {
  console.log(createHeader(title, subtitle));
  console.log(createDivider(undefined, "primary"));
};

// Print tips section
export const printTips = (tips: string[]): void => {
  console.log("\n" + colors.bold("Tips for getting started:"));
  tips.forEach((tip) => {
    console.log(createListItem(tip));
  });
};

// Print current directory info
export const printCwd = (path: string): void => {
  console.log(
    createBox(
      [`cwd: ${colors.secondary(path)}`],
      { color: "primary", padding: 0 },
    ),
  );
};

