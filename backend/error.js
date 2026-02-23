
//Create types of errors
class MainErrors extends Error{
    constructor(message, status_code){
        super(message)//this calls Error constructor to keep error chain alive

        this.StatusCode = status_code//status code for each inherited error
    }
}

class GeneralError extends MainErrors{
  constructor(message){
        super(message, 500)
    }
}

class NotFoundError extends MainErrors{
    constructor(message){
        super(message, 404)
    }
}

class DataError extends MainErrors{
    constructor(message){
        super(message, 400)
    }
}

//Failure of Auth, need new token:
class UnauthorizedError extends MainErrors {
  constructor(message) {
    super(message, 401);
  }
}

class ForbiddenError extends MainErrors {
  constructor(message) {
    super(message, 403);
  }
}

module.exports = {GeneralError, NotFoundError, DataError, UnauthorizedError, ForbiddenError, }