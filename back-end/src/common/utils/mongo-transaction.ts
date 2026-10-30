import type { ClientSession, Connection } from 'mongoose';

export async function executarTransacao<T>(connection: Connection, operation: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await connection.startSession();
  try {
    let result!: T;
    let completed = false;
    await session.withTransaction(async () => {
      result = await operation(session);
      completed = true;
      return result;
    });
    if (!completed) throw new Error('A transação MongoDB terminou sem executar a operação.');
    return result;
  } finally {
    await session.endSession();
  }
}
