import crypto from "crypto";

export const generateRandomCode = () => {
  const code = crypto.randomInt(0, 1000000);
  return code.toString().padStart(6, "0");
};
