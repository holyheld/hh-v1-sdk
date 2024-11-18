export const getSpinnerHTML = () => '<img src="data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQwMCAyNDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogICAgPGcgc3Ryb2tlLXdpZHRoPSIyMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlPSIjMDAwIj4KICAgICAgPGxpbmUgeDE9IjEyMDAiIHkxPSI2MDAiIHgyPSIxMjAwIiB5Mj0iMTAwIiAvPgogICAgICA8bGluZSBvcGFjaXR5PSIwLjUiIHgxPSIxMjAwIiB5MT0iMjMwMCIgeDI9IjEyMDAiIHkyPSIxODAwIiAvPgogICAgICA8bGluZSBvcGFjaXR5PSIwLjkxNyIgeDE9IjkwMCIgeTE9IjY4MC40IiB4Mj0iNjUwIiB5Mj0iMjQ3LjQiIC8+CiAgICAgIDxsaW5lIG9wYWNpdHk9IjAuNDE3IiB4MT0iMTc1MCIgeTE9IjIxNTIuNiIgeDI9IjE1MDAiIHkyPSIxNzE5LjYiIC8+CiAgICAgIDxsaW5lIG9wYWNpdHk9IjAuODMzIiB4MT0iNjgwLjQiIHkxPSI5MDAiIHgyPSIyNDcuNCIgeTI9IjY1MCIgLz4KICAgICAgPGxpbmUgb3BhY2l0eT0iMC4zMzMiIHgxPSIyMTUyLjYiIHkxPSIxNzUwIiB4Mj0iMTcxOS42IiB5Mj0iMTUwMCIgLz4KICAgICAgPGxpbmUgb3BhY2l0eT0iMC43NSIgeDE9IjYwMCIgeTE9IjEyMDAiIHgyPSIxMDAiIHkyPSIxMjAwIiAvPgogICAgICA8bGluZSBvcGFjaXR5PSIwLjI1IiB4MT0iMjMwMCIgeTE9IjEyMDAiIHgyPSIxODAwIiB5Mj0iMTIwMCIgLz4KICAgICAgPGxpbmUgb3BhY2l0eT0iMC42NjciIHgxPSI2ODAuNCIgeTE9IjE1MDAiIHgyPSIyNDcuNCIgeTI9IjE3NTAiIC8+CiAgICAgIDxsaW5lIG9wYWNpdHk9IjAuMTY3IiB4MT0iMjE1Mi42IiB5MT0iNjUwIiB4Mj0iMTcxOS42IiB5Mj0iOTAwIiAvPgogICAgICA8bGluZSBvcGFjaXR5PSIwLjU4MyIgeDE9IjkwMCIgeTE9IjE3MTkuNiIgeDI9IjY1MCIgeTI9IjIxNTIuNiIgLz4KICAgICAgPGxpbmUgb3BhY2l0eT0iMC4wODMiIHgxPSIxNzUwIiB5MT0iMjQ3LjQiIHgyPSIxNTAwIiB5Mj0iNjgwLjQiIC8+CiAgICAgIDxhbmltYXRlVHJhbnNmb3JtCiAgICAgICAgYXR0cmlidXRlTmFtZT0idHJhbnNmb3JtIgogICAgICAgIGF0dHJpYnV0ZVR5cGU9IlhNTCIKICAgICAgICB0eXBlPSJyb3RhdGUiCiAgICAgICAga2V5VGltZXM9IjA7MC4wODMzMzswLjE2NjY3OzAuMjU7MC4zMzMzMzswLjQxNjY3OzAuNTswLjU4MzMzOzAuNjY2Njc7MC43NTswLjgzMzMzOzAuOTE2NjciCiAgICAgICAgdmFsdWVzPSIwIDExOTkgMTE5OTszMCAxMTk5IDExOTk7NjAgMTE5OSAxMTk5OzkwIDExOTkgMTE5OTsxMjAgMTE5OSAxMTk5OzE1MCAxMTk5IDExOTk7MTgwIDExOTkgMTE5OTsyMTAgMTE5OSAxMTk5OzI0MCAxMTk5IDExOTk7MjcwIDExOTkgMTE5OTszMDAgMTE5OSAxMTk5OzMzMCAxMTk5IDExOTkiCiAgICAgICAgZHVyPSIwLjgzMzMzcyIKICAgICAgICBiZWdpbj0iMHMiCiAgICAgICAgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiCiAgICAgICAgY2FsY01vZGU9ImRpc2NyZXRlIgogICAgICAvPgogICAgPC9nPgogIDwvc3ZnPg==" width="24" height="24" />';

export const getSettingsHTML = (isTopupEnabled, minTopUpAmountInEUR, maxTopUpAmountInEUR) => `
  <dl>
    <dt>Functionality is available:</dt>
    <dd>${isTopupEnabled ? '<span style="color: green">Yes<span>' : '<span style="color: red">No<span>'}</dd>
    <dt>Minimum amount:</dt>
    <dd>${minTopUpAmountInEUR} EUR</dd>
    <dt>Maximum amount:</dt>
    <dd>${maxTopUpAmountInEUR} EUR</dd>
  </dl>
  <br>
  <label>
    $holytag:<br>
    <input type="text" value="SDKTEST"/>
  </label>
`;

export const getRadioItemHTML = (isFirst, address, network, networkDisplayedName, name, balance, symbol) => `
  <div>
    <input type="radio" id="${address}${network}" name="drone" value="${address},${network}" ${isFirst ? 'checked' : ''}/>
    <label for="${address}${network}">
      ${name} |
      ${networkDisplayedName} |
      ${balance} ${symbol}
    </label>
  </div>
`;

export const getTokenInfoHTML = (name, address, networkDisplayedName, balance, symbol) => `
  <dl>
    <dt>Name:</dt>
    <dd>${name}</dd>
    <dt>Address:</dt>
    <dd>${address}</dd>
    <dt>Network:</dt>
    <dd> ${networkDisplayedName}</dd>
    <dt>Balance:</dt>
    <dd>${balance} ${symbol}</dd>
  </dl>
  <br>
  <label>
    Token amount: <br>
    <input type="number" placeholder="5.00" /> ${symbol}
  </label>
`;

export const getDataHTML = (name, address, networkDisplayedName, symbol, amount, amountInEUR, holytag) => `
  <dl>
    <dt>Name:</dt>
    <dd>${name}</dd>
    <dt>Address:</dt>
    <dd>${address}</dd>
    <dt>Network:</dt>
    <dd>${networkDisplayedName}</dd>
    <dt>Amount in ${symbol}:</dt>
    <dd>${amount} ${symbol}</dd>
    <dt>Amount in EUR:</dt>
    <dd>${amountInEUR === '0' ? '0.01' : amountInEUR} EUR</dd>
    <dt>$holytag:</dt>
    <dd>${holytag}</dd>
  </dl>
`;
