// 判断文件或文件夹是否存在
const fs = require("fs");
fs.stat('/a/b/c', function(err, stat) {
    if(err == null) {
        if(stat.isDirectory()) {
            console.log('文件夹存在');
        } else if(stat.isFile()) {
            console.log('文件存在');
        } else {
            console.log('路径存在，但既不是文件，也不是文件夹');
            //输出路径对象信息
            console.log(stat);
        }
    } else if(err.code == 'ENOENT') {
        console.log(err.name);
        console.log('路径不存在');
    } else {
        console.log('错误：' + err);
    }
});