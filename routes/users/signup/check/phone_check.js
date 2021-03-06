const express = require('express');
const router = express.Router();
const db = require('../../../../module/pool.js');

router.post('/',async(req,res)=>{
  let phone = req.body.phone;

  if(!phone){
    res.status(400).send(
      {
        message:"Null Value"
      }
    );
  }else{   
    var regExp = /^([0-9]{2,3})-?([0-9]{3,4})-?([0-9]{4})$/;

    if (!regExp.test(phone)){
      res.status(400).send(
        {
          message:"Invalid Data"
        }
      );
    }else{
      let checkUserQuery = 'SELECT * FROM user WHERE user_phone =?';
      let checkUserResult = await db.queryParam_Arr(checkUserQuery,[phone]);
      let checkSupplierQuery = 'SELECT * FROM supplier WHERE sup_phone =?';
      let checkSupplierResult = await db.queryParam_Arr(checkSupplierQuery,[phone]);

      if(!checkUserResult || !checkSupplierResult){
        res.status(500).send({
          message:"Internal Server Error"
        });
      }else if (checkUserResult.length === 1 || checkSupplierResult.length === 1){
        res.status(400).send({
          message:"This Phone Number Already Exists."
        });
      }else{
        res.status(200).send({
          message:"Success Phone Number Check"
        });
      }
    }
  }
});

module.exports = router;