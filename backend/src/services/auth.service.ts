import jwt from "jsonwebtoken";

import prisma from "../config/database.js";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return secret;
};

export const createAuthToken = (user: AuthUser): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
    },
  );
};

export const getUserById = async (
  userId: string,
): Promise<AuthUser | null> => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
    },
  });

  return user;
};