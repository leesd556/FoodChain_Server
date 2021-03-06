const express = require('express');
const router = express.Router();
const async = require('async');
const upload = require('../../config/s3multer.js');
const pool = require('../../config/dbPool.js');
const pool_async = require('../../config/dbPool_async.js');
const jwt = require('../../module/jwt.js');
const identifier = require('../../module/token_identifier.js');

router.get('/', (req, res) => {
	let bookmark_info = [];
	let product = {};
	let product_image = [];

	let token = req.headers.token;

	let taskArray = [
	// 1. token 유효성 검사, 해당 토큰에 대한 정보 반환
	function(callback){
		return new Promise((resolve, reject)=>{
			identifier(token, function(err, result){
				if(err) reject(err);
				else resolve(result);
			});
		}).then(function(identify_data){
			callback(null, identify_data);
		}).catch(function(err){
			res.status(500).send({
				message : err
			});
			return ;
			console.log(err);
		});
	},

		// 2. pool에서 connection 하나 가져오기
		function(identify_data, callback) {
			pool.getConnection(function(err, connection) {
				if (err) {
					res.status(500).send({
						message: "Internal Server Error"
					}); 
					connection.release();
					callback("pool.getConnection Error : " + err);
				} else {
					callback(null, connection, identify_data);
				}
			});
		},
		// 3.해당 토큰의 idx를 가져와서 북마크한 상품이 뭔지 파악한다.
		function(connection, identify_data, callback){
			// user or sup index를 사용하여 product index를 가져온다.
			let getSupBookmarkIdxQuery = "SELECT pro_idx FROM bookmark WHERE sup_idx = ? OR user_idx = ?";
			connection.query(getSupBookmarkIdxQuery, [identify_data.idx, identify_data.idx], function(err, result){
				if(err) {
					res.status(500).send({
						message : "Internal Server Error"
					});
					connection.release();
					callback("connection.query Error : " + err);
				}
				if(result.length == 0){
					res.status(500).send({
						message : "No data"
					});
					callback("No data");
					return;
				}
				connection.release();
				callback(null, result);
			});
		},
		// 4. 받아온 pro_idx로 북마크 정보를 조회한다.
		function(pro_idx, callback){
			let getBookmarkProductQuery = "SELECT * FROM product NATURAL JOIN market WHERE pro_idx = ?";

			(async function(){
				let connection = await pool_async.getConnection();

				for(let i = 0 ; i < pro_idx.length ; i++){
					let value = pro_idx[i];
					let result = await pool_async.query(getBookmarkProductQuery, value.pro_idx);
					let data = result[0];

					if(result === undefined){
						res.status(500).send({
							message : "Internal Server Error"
						});
						connection.release();
						callback("connection.query Error : " + err);
					}

					if(data.length != 0){
						product = {};
						product.pro_idx = data[0].pro_idx;
						product.pro_name = data[0].pro_name;
						product.pro_price = data[0].pro_price;
						product.pro_sale_price = data[0].pro_sale_price;
						product.pro_info = data[0].pro_info;
						bookmark_info[i] = {};
						bookmark_info[i] = product;
					} 
				}

				connection.release();
				callback(null, pro_idx);
			})();
		},

		function(pro_idx, callback){
			let getProductImageQuery = "SELECT pro_img FROM product_image WHERE pro_idx = ?";

			(async function(){
				let connection = await pool_async.getConnection();

				for(let i = 0 ; i < bookmark_info.length ; i++){
					let value = bookmark_info[i];
					let result = await pool_async.query(getProductImageQuery, value.pro_idx);
					let data = result[i];
					//console.log("i : "+ i + " " +result[i]);
					if(result === undefined){
						res.status(500).send({
							message : "Internal Server Error"
						});
						connection.release();
						callback("connection.query Error : " + err);
					}

					if(data){
						product_image = [];
						for(let j = 0 ; j < data.length ; j++){
							product_image[j] = data[j].pro_img;
						}
						bookmark_info[i].pro_img = product_image.slice(0);
					}
				}
				connection.release();
				callback(null, "Success to Get Data");
			})();
		}
		];
		async.waterfall(taskArray, function(err, result){
			if(err){
				console.log(err);
			} else {
				res.status(200).send({
					message : result,
					data : bookmark_info
				});
				console.log(result);
			}
		});
	});

router.post('/', (req, res) =>{
	let token = req.headers.token;
	let pro_idx = req.body.pro_idx;

	if(!pro_idx){
		res.status(400).send({
			message : "Null Value"
		});
	}
	
	let taskArray = [
	// 1. token 유효성 검사, 해당 토큰에 대한 정보 반환
		function(callback){
			return new Promise((resolve, reject)=>{
				identifier(token, function(err, result){
					if(err) reject(err);
					else resolve(result);
				});
			}).then(function(identify_data){
				callback(null, identify_data);
			}).catch(function(err){
				res.status(500).send({
					message : err
				});
				return ;
				console.log(err);
			});
		},

		// 2. pool에서 connection 하나 가져오기
		function(identify_data, callback) {
			pool.getConnection(function(err, connection) {
				if (err) {
					res.status(500).send({
						message: "Internal Server Error"
					}); 
					connection.release();
					callback("pool.getConnection Error : " + err);
				} else {
					callback(null, connection, identify_data);
				}
			});
		},
		// 3. 북마크 등록
		function(connection, identify_data, callback){
			let insertBookmarkQuery = "";
			if(identify_data.identify == 0)
				insertBookmarkQuery = "INSERT INTO bookmark (user_idx, pro_idx) VALUES(?, ?)";
			else
				insertBookmarkQuery = "INSERT INTO bookmark (sup_idx, pro_idx) VALUES(?, ?)";

			connection.query(insertBookmarkQuery, [identify_data.idx, pro_idx], function(err, result){
				if(err) {
					res.status(500).send({
						message : "Internal Server Error"
					});
					connection.release();
					callback("connection.query Error : " + err);
				} else{
					callback(null, result);
					connection.release(); 
				}
			});
		}
		];
		async.waterfall(taskArray, function(err, result){
			if(err){
				console.log(err);
			} else {
				res.status(200).send({
					message : "Success to Register Data"
				});
			}
		});

});

router.delete('/', (req, res) =>{
	let token = req.headers.token;
	let pro_idx = req.body.pro_idx;

	if(!pro_idx){
		res.status(400).send({
			message : "Null Value"
		});
	}
	
	let taskArray = [
	// 1. token 유효성 검사, 해당 토큰에 대한 정보 반환
		function(callback){
			return new Promise((resolve, reject)=>{
				identifier(token, function(err, result){
					if(err) reject(err);
					else resolve(result);
				});
			}).then(function(identify_data){
				callback(null, identify_data);
			}).catch(function(err){
				res.status(500).send({
					message : err
				});
				return ;
				console.log(err);
			});
		},

		// 2. pool에서 connection 하나 가져오기
		function(identify_data, callback) {
			pool.getConnection(function(err, connection) {
				if (err) {
					res.status(500).send({
						message: "Internal Server Error"
					}); 
					connection.release();
					callback("pool.getConnection Error : " + err);
				} else {
					callback(null, connection, identify_data);
				}
			});
		},
		// 3. 북마크 등록
		function(connection, identify_data, callback){
			let deleteBookmarkQuery = "";
			if(identify_data.identify == 0)
				deleteBookmarkQuery = "DELETE FROM bookmark WHERE user_idx = ? AND pro_idx =?";
			else
				deleteBookmarkQuery = "DELETE FROM bookmark WHERE sup_idx = ? AND pro_idx =?";


			connection.query(deleteBookmarkQuery, [identify_data.idx, pro_idx], function(err, result){
				if(err) {
					res.status(500).send({
						message : "Internal Server Error"
					});
					connection.release();
					callback("connection.query Error : " + err);
				} else{
					connection.release();
					callback(null, result);
				}
			});
		}
		];
		async.waterfall(taskArray, function(err, result){
			if(err){
				console.log(err);
			} else {
				res.status(200).send({
					message : "Success to Delete Data"
				});
			}
		});

});

module.exports = router;
