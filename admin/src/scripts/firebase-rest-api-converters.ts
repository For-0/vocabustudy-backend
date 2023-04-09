import { FirestoreField, FirestoreFieldObject, RawFirestoreField, RawFirestoreFieldObject } from "../../function-utils/common-types";

export function parseField(field: RawFirestoreField): FirestoreField {
    if (field.integerValue) return parseInt(field.integerValue);
    else if (field.doubleValue) return parseFloat(field.doubleValue);
    else if (field.booleanValue) return field.booleanValue;
    else if (field.stringValue) return field.stringValue;
    else if (field.timestampValue) return new Date(Date.parse(field.timestampValue));
    else if (field.referenceValue) return field.referenceValue;
    else if (field.mapValue) return parseMap(field.mapValue);
    else if (field.arrayValue?.values) return field.arrayValue.values.map(parseField);
    else if (field.arrayValue) return [];
    else if (field.nullValue) return null;
    else return null;
}

export function parseMap (map: { fields: RawFirestoreFieldObject }): FirestoreFieldObject {
    const result = {};
    for (const key in map.fields) result[key] = parseField(map.fields[key]);
    return result;
}