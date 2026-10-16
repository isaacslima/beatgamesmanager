class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Envolve um handler assíncrono: HttpError vira resposta com o status dele; o resto vira 500.
function handle(fallbackMessage, fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        return res.status(error.status).json({ message: error.message });
      }

      console.error(error);
      return res.status(500).json({ message: fallbackMessage });
    }
  };
}

module.exports = { HttpError, handle };
