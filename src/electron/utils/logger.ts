export const logGM = (stdtype: string, command: string, data: string) => {
  console.log(`[${command} (${stdtype})] ${data}`);
}