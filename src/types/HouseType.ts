export interface HouseType {
    id?: string | undefined | null;
    name?: string | undefined | null;
    address?: string | undefined | null;
    price?: string | undefined | null;
    tags? : string[] | undefined | null;
    isRemoved?: boolean | undefined | null;
    imageSrc?: string | undefined | null;
    link?: string | undefined | null;
    owner? : "DuProprio" | "Remax" | undefined | null;
}
