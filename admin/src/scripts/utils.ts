import { toast } from "bulma-toast";
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

export function getUserAvatar(uid: string, photoUrl?: string) {
    const listItemImage = document.createElement("div");
    listItemImage.classList.add("list-item-image");
    const imageFigure = listItemImage.appendChild(document.createElement("figure"));
    imageFigure.classList.add("image", "is-48x48", "has-tooltip-arrow", "has-tooltip-right", "is-clickable", "has-tooltip-info");
    const image = imageFigure.appendChild(document.createElement("img"));
    image.classList.add("is-rounded");
    image.referrerPolicy = "no-referrer";
    image.src = photoUrl || new URL("../images/icon-192-maskable.png", import.meta.url).href;
    imageFigure.dataset.tooltip = "Copy UID";
    imageFigure.addEventListener("click", async () => {
        await navigator.clipboard.writeText(uid);
        toast({ message: "Copied to clipboard!", type: "is-success", animate: { in: "rubberBand", out: "backOutUp" }  })
    });
    return listItemImage;
}