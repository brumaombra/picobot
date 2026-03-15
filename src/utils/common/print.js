import chalk from 'chalk';

// Print a new line
export const newline = () => {
    console.log('');
};

// Print a standard log
export const basicLog = message => {
    console.log(message);
};

// Print a success message in green with a checkmark
export const success = message => {
    console.log(chalk.green(`✅  ${message}`));
};

// Print an error message in red with an X mark
export const error = message => {
    console.log(chalk.red(`❌  ${message}`));
};

// Print a warning message in yellow with a warning symbol
export const warning = message => {
    console.log(chalk.yellow(`⚠️   ${message}`)); // Needs triple space after emoji for alignment
};

// Print an info message in blue with an info symbol
export const info = message => {
    console.log(chalk.blue(`ℹ️   ${message}`)); // Needs triple space after emoji for alignment
};

// Print a suggestion with magenta color and lightbulb emoji
export const suggestion = message => {
    console.log(chalk.magenta(`💡  ${message}`));
};

// Print a header with cyan color
export const header = title => {
    console.log(chalk.cyan.bold(`\n${title}\n`));
};

// Print a list item with bullet point and optional indentation
export const listItem = (item, color = 'gray', indent = 0) => {
    const prefix = ' '.repeat(indent) + '•';
    const colorFn = chalk[color] || chalk.gray;
    console.log(colorFn(`${prefix} ${item}`));
};

// Print the ASCII art Picobot logo
export const logo = () => {
    const logo = `
██████╗ ██╗ ██████╗ ██████╗ ██████╗  ██████╗ ████████╗
██╔══██╗██║██╔════╝██╔═══██╗██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝██║██║     ██║   ██║██████╔╝██║   ██║   ██║
██╔═══╝ ██║██║     ██║   ██║██╔══██╗██║   ██║   ██║
██║     ██║╚██████╗╚██████╔╝██████╔╝╚██████╔╝   ██║
╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚═════╝  ╚═════╝    ╚═╝
    `;
    console.log(chalk.cyan.bold(logo));
};