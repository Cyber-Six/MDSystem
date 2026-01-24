const { GraphQLError } = require("graphql");

class GraphQLErrorBuilder {
  constructor(res) {
    this.res = res;
    this._status = 400; // default
    this._message = "Bad Request"; // default
    this._code = "BAD_REQUEST"; // default
    this.res.status(this._status);
  }

  status(code) {
    this._status = code;
    this.res.status(code);

    const map = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      500: "INTERNAL_SERVER_ERROR",
    };
    this._code = map[code] || "INTERNAL_SERVER_ERROR";

    return this;
  }

  message(msg) {
    this._message = msg;
    return this;
  }

  throw() {
    throw new GraphQLError(this._message, {
      extensions: { code: this._code },
    });
  }
}

function throwGraphQLError(res) {
  return new GraphQLErrorBuilder(res);
}

module.exports = { throwGraphQLError };
