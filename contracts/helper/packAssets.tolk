fun convertAssetsTupleToCell(assetsTuple: tuple, currentIndex: int): cell {
    // Remaining assets count
    var remainingAssetsCount: int = assetsTuple.size() - currentIndex;

    // One cell can only have 4 references, so we can only pack 3 assets at most and use the last cell to pack the remain assets
    val assetCount: int = min(3, remainingAssetsCount);
    var assetsCell: builder = beginCell();

    // We used a recursive approach to ensure each cell stores only 3 assets, with the fourth reference used to continue storing the remaining assets, following the same rule.
    repeat (assetCount) {
        val asset: cell = assetsTuple.get(currentIndex);
        assetsCell = assetsCell.storeRef(asset);
        currentIndex += 1;
    }

    // Update remainingAssetsCount
    remainingAssetsCount -= assetCount;

    if (remainingAssetsCount > 0) {
        val nextAssetsCell: cell = convertAssetsTupleToCell(assetsTuple, currentIndex);
        return assetsCell.storeRef(nextAssetsCell).endCell();
    }

    return assetsCell.endCell();
}