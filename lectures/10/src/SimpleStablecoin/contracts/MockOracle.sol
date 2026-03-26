contract MockOracle {
    uint256 private exchangeRate; // tokenA per tokenB

    constructor(uint256 _initialRate) {
        exchangeRate = _initialRate;
    }

    function setExchangeRate(uint256 _rate) external {
        exchangeRate = _rate;
    }

    function getExchangeRate() external view returns (uint256) {
        return exchangeRate;
    }
}
