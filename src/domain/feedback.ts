export const MAX_FEEDBACK_LENGTH = 2_000;

const normalizeCommand = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]/gu, "");

export const feedbackCommandAliases = new Set(["feedback", "geribildirim"]);

export const parseFeedbackCommand = (content: string, prefixes: string[]) => {
  const prefix = prefixes.find((candidate) => content.startsWith(candidate));
  if (!prefix) {
    return undefined;
  }

  const remainder = content.slice(prefix.length).trimStart();
  const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(remainder);
  if (!match || !feedbackCommandAliases.has(normalizeCommand(match[1] ?? ""))) {
    return undefined;
  }

  return {
    message: (match[2] ?? "").trim(),
  };
};

export const truncateFeedback = (message: string, maxLength = 320) =>
  message.length > maxLength ? `${message.slice(0, maxLength - 1)}…` : message;
