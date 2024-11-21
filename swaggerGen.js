"use strict";

// ---- Global variables ----
let convertToNumber = true;
let addExamples = true;

// ---- Functions definitions ----
function changeIndentation(count) {
  // will disable this function, so we will return json object;
    return "";
  /**
   * Returns indentation string based on given tab count.
   */
  return "\n" + "\t".repeat(count);
}

function converterSelection(obj, tabCount) {
  /**
   * Selects which conversion method to call based on given object type.
   */
  let indentation = changeIndentation(tabCount + 1);
  let result = "";

  if (typeof obj === "number") {
    result += convertNumber(obj, indentation);
  } else if (Array.isArray(obj)) {
    result += convertArray(obj, tabCount);
  } else if (typeof obj === "object" && obj !== null) {
    result += convertObject(obj, tabCount);
  } else if (typeof obj === "string") {
    result += convertString(obj, indentation);
  } else if (typeof obj === "boolean") {
    result += `${indentation}"type": "boolean"`;
  } else {
    throw new Error(`Property type "${typeof obj}" not valid for Swagger definitions`);
  }
  return result;
}

function convertNumber(num, indentation) {
  /**
   * Converts number to Swagger schema attributes.
   */
  let result = "";
  if (Number.isInteger(num) && !convertToNumber) {
    result += `${indentation}"type": "integer",`;
    result += num < 2147483647 && num > -2147483647 ? `${indentation}"format": "int32"` : `${indentation}"format": "int64"`;
  } else {
    result += `${indentation}"type": "number"`;
  }
  if (addExamples) {
    result += `,${indentation}"example": ${num}`;
  }
  return result;
}

function convertString(str, indentation) {
  /**
   * Converts string to Swagger schema attributes.
   */
  const regxDate = /^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
  const regxDateTime = /^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])[T ]([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,3})?(Z|(\+|\-)([0-1][0-9]|2[0-3]):[0-5][0-9])$/;

  let result = `${indentation}"type": "string"`;
  if (regxDateTime.test(str)) {
    result += `,${indentation}"format": "date-time"`;
  } else if (regxDate.test(str)) {
    result += `,${indentation}"format": "date"`;
  }
  if (addExamples) {
    result += `,${indentation}"example": "${str}"`;
  }
  return result;
}

function convertArray(arr, tabCount) {
  /**
   * Converts array to Swagger schema attributes.
   */
  let indentation = changeIndentation(tabCount + 1);
  let result = `${indentation}"type": "array",`;
  result += `${indentation}"items": {`;
  result += converterSelection(arr[0], tabCount + 1); // Assuming homogeneous arrays
  result += `${indentation}}`;
  if (addExamples) {
    result += `,${indentation}"example": ${JSON.stringify(arr, null, "\t").replace(/\n/g, indentation)}`;
  }
  return result;
}

function convertObject(obj, tabCount) {
  /**
   * Converts object to Swagger schema attributes.
   */
  let indentation = changeIndentation(tabCount);
  let result = `${indentation}"type": "object",`;
  result += `${indentation}"properties": {`;
  const keys = Object.keys(obj);

  keys.forEach((key, index) => {
    result += `${changeIndentation(tabCount + 1)}"${key}": {`;
    result += converterSelection(obj[key], tabCount + 1);
    result += `${changeIndentation(tabCount + 1)}}`;
    if (index < keys.length - 1) {
      result += ",";
    }
  });

  result += `${indentation}}`;
  return result;
}

function convert(inJSON) {
  /**
   * Main function to convert JSON to Swagger schema.
   */
  let parsedJSON;
  try {
    parsedJSON = JSON.parse(inJSON);
  } catch (e) {
    throw new Error("Your JSON is invalid!\n(" + e + ")");
  }

  let tabCount = 0;
  let outSwagger = `{`;

  const keys = Object.keys(parsedJSON);
  keys.forEach((key, index) => {
    outSwagger += `${changeIndentation(1)}"${key}": {`;
    outSwagger += converterSelection(parsedJSON[key], 1);
    outSwagger += `${changeIndentation(1)}}`;
    if (index < keys.length - 1) {
      outSwagger += ",";
    }
  });

  outSwagger += `${changeIndentation(0)}}`;
  return JSON.parse(outSwagger);
}

// Example usage:
// const swaggerSchema = convert('{"example": {"name": "John", "age": 30, "isActive": true}}');
// console.log(swaggerSchema);
