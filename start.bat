@echo off
title Cloud Study Resource Vault
echo ========================================================
echo   Cloud Study Resource Vault - Static Web Application
echo ========================================================
echo.
echo Launching application in your default browser...
start http://localhost:3000
echo.
echo Static Web Server is running at: http://localhost:3000
echo Pure HTML5 + CSS3 + Vanilla JavaScript + Firebase
echo (No backend server code - all data stored directly in Firebase)
echo.
echo Press Ctrl + C in this window when you want to stop.
echo ========================================================
echo.

node -e "const http=require('http'),fs=require('fs'),path=require('path');const m={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.pdf':'application/pdf','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml'};http.createServer((req,res)=>{let f=path.join('.',decodeURIComponent(req.url.split('?')[0]));if(f==='.')f='./index.html';if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');fs.readFile(f,(e,d)=>{if(e){res.writeHead(404,{'Content-Type':'text/plain'});res.end('404 Not Found');}else{res.writeHead(200,{'Content-Type':m[path.extname(f)]||'application/octet-stream'});res.end(d);}});}).listen(3000);"
