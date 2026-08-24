export function destinationBody(token, sourceBody, bodyCount) {
  if (!token.pass) {
    return sourceBody;
  }
  if (token.passTarget === null) {
    if (bodyCount !== 2) {
      throw new Error("implicit pass needs exactly two bodies");
    }
    return 1 - sourceBody;
  }
  const target = token.passTarget - 1;
  if (target < 0 || target >= bodyCount) {
    throw new Error("pass target outside the body set");
  }
  return target;
}

export function destinationContact(token, sourceContact) {
  return token.crossing ? 1 - sourceContact : sourceContact;
}

export function globalContact(body, contact) {
  return body * 2 + contact;
}

export function bodyOfContact(contact) {
  return Math.floor(contact / 2);
}

export function localContact(contact) {
  return contact % 2;
}

export function isPassThrow(token, sourceBody, bodyCount) {
  return destinationBody(token, sourceBody, bodyCount) !== sourceBody;
}
