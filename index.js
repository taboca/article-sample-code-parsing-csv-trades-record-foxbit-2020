const path      = require('path');
const fs        = require('fs');

/* 
 Test input sources
 
 You can uncomment the line to pick a test that interests you. The complex one is the last. 
   */

/* source sample 1 :
   description     : One deposit, one buy trade */ 
//const FILE_INPUT  =  path.join(__dirname, 'src-tests', 'foxbit-v1', 'sample-01.csv' );

/* source sample 2 :
   description     : Two buy trades  */ 
//const FILE_INPUT  =  path.join(__dirname, 'src-tests', 'foxbit-v1', 'sample-02.csv' );

/* source sample 3 :
   description     : 3 buy trades and 1 sell trade, with some deposits in the middle */ 
//const FILE_INPUT  =  path.join(__dirname, 'src-tests', 'foxbit-v1', 'sample-03.csv' );

/* source sample 4 :
   descrition      : Buy trades, followed by sell trades, followed by buy trades, 
                     with the commission fee out of sync.  */ 
const FILE_INPUT  =  path.join(__dirname, 'src-tests', 'foxbit-v1', 'sample-04.csv' );

const FILE_OUTPUT =  path.join(__dirname, `trades-structured.json` );

function outFile(data) { 
  fs.writeFile(FILE_OUTPUT, JSON.stringify(data, ' ', 2) , function(err){
    if (err) {
      //res.end();
      throw err;
    }
  });
}

function parseInstrument(refString) { 
/* Buy btc, from brl 
  tradeTmp1: '03/09/2020 16:44:26,Trade,BTC,"0,08673929","0,00000000","0,08706877","Preço do Ativo: R$ 57625,57"',
  tradeTmp2: '03/09/2020 16:44:26,Trade,BRL,"-4998,40000000","0,00000000","8,06000000","Preço do Ativo: R$ 57625,57"',

  Sell btc, get brl
  tradeTmp1: '24/09/2020 15:25:29,Trade,BRL,"1318,22000000","0,00000000","6319,32000000","Preço do Ativo: R$ 58958,32"',
  tradeTmp2: '24/09/2020 15:25:29,Trade,BTC,"-0,02235847","0,00000000","0,23708398","Preço do Ativo: R$ 58958,32"',

  */
  let blocsByQuotes = refString.split("\"");
  let blocsByComma = refString.split(",");

  let amount = blocsByQuotes[1].split(",")[0] + "." + blocsByQuotes[1].split(",")[1];
  
  let priceAtTrade = blocsByQuotes[7].split("Preço do Ativo: R$ ")[1];
      priceAtTrade = priceAtTrade.split(",")[0] + "." + priceAtTrade.split(",")[1];

  let balance = blocsByQuotes[5].split(",")[0] + "." + blocsByQuotes[5].split(",")[1];

  let result = { 
    "datetime"   : blocsByComma[0],
    "instrument" : blocsByComma[2],
    "amount"     : amount,
    "balance"    : balance, 
    "price"      : priceAtTrade
  }
  return result;
}

function parseFee(refString) { 
  /* 
    03/09/2020 16:44:26,Comissão no Trade,BTC,"0,00000000","-0,00043370","0,08663507",
    */
  
    let blocsByQuotes = refString.split("\"");
    let blocsByComma = refString.split(",");

    let result = { 
      "datetime"   : blocsByComma[0],
      "instrument" : blocsByComma[2],
      "amount"     : blocsByQuotes[3],
      "balance"    : blocsByQuotes[5]
    }
    return result;
  
}

function run()  { 
    
  fs.readFile(FILE_INPUT, 'utf8', function (err,data) {
    if (err) {
      return console.log(err);
    }
    
    let dataTXT = data;
    
    balanceFee = 0; 
    balanceUSDT = 0; 
    balanceQuantity = 0; 
    
    let dataLines = data.split("\n");
    
    let total_deposits = [];
    let total_trades = [];

    let tradeFiller = 0; 
    let tradeSide = 0; 

    let tradeCurrent = {
      in: {
        csvLineTradeTmp1: "",
        csvLineTradeTmp2: "",
        csvLineTradeTmp1Instrument: "",
        csvLineTradeTmp2Instrument: "",
        csvLineFee: ""
      },
      out: {
        from: null,
        to:null,
        fee: null
      }
    };
    
    for(let i=0; i<dataLines.length; i++) { 
      
      let curr = dataLines[i].split(",");

      if(curr[1] == 'Depósito') { 
          let curr = {
              "kind": "deposit", 
              "value": dataLines[i]
          }
          total_deposits.push(curr);  
      }

      if(curr[1] == 'Comissão no Trade') { 
          tradeCurrent.in.csvLineFee = dataLines[i]; 
          tradeCurrent.out.fee = parseFee(dataLines[i]);
          console.log(tradeCurrent.out.fee);
          tradeFiller++;
      }

      if(curr[1] == 'Trade') { 
          if(tradeSide==0) { 
              console.log()
              tradeCurrent.in.csvLineTradeTmp1 = dataLines[i];
              tradeCurrent.in.csvLineTradeTmp1Instrument = curr[2];
              tradeSide++;
          } else { 
              tradeCurrent.in.csvLineTradeTmp2 = dataLines[i];
              tradeCurrent.in.csvLineTradeTmp2Instrument = curr[2];
          }
          tradeFiller++;
      }

      if(tradeFiller==3) { 
          /* If the asset type of the commission is equal to the kind of the line 1, 
              then, it means that the kind of line was was the one bought. */
          if(tradeCurrent.out.fee.instrument == tradeCurrent.in.csvLineTradeTmp1Instrument) { 
            tradeCurrent.out.from = parseInstrument(tradeCurrent.in.csvLineTradeTmp2);
            tradeCurrent.out.to =  parseInstrument(tradeCurrent.in.csvLineTradeTmp1);
            
          } else { 
            tradeCurrent.out.from = parseInstrument(tradeCurrent.in.csvLineTradeTmp1);
            tradeCurrent.out.to =  parseInstrument(tradeCurrent.in.csvLineTradeTmp2);
          }

          let strTemp = JSON.stringify(tradeCurrent, ' ', 2);
          console.log(strTemp);
          //console.log(JSON.parse(strTemp));
          total_trades.push(JSON.parse(strTemp)); 
          tradeSide = 0;
          tradeFiller = 0;
      }
      let datetime = curr[0];
      let kind = curr[1]; 
    }
    outFile(total_trades);
  });
  
}

run(); 
