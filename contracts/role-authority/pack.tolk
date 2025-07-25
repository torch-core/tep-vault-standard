import "auth";
import "constants/size";
import "constants/type";

/// @dev Packs a dictionary value (RoleMask or bool) into a slice
/// @param dictValue The value to pack, either a RoleMask or boolean
/// @return slice The packed value as a slice ready for dictionary storage
@pure
fun packDictSliceValue(dictValue: RoleMask | bool): slice {
    match (dictValue) {
        RoleMask => return beginCell().storeUint(dictValue, ROLE_MASK_SIZE).endCell().beginParse(),
        bool => return beginCell().storeBool(dictValue).endCell().beginParse(),
    }
}

