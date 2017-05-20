// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
// const ipc = require('electron').ipcRenderer;

// TODO: 下载失败重试时, 需要加次数限制, 避免死循环

const request = require('request');
const async = require('async');
const fs = require('fs');
const server = 'http://xxx.com:80';
const workspace = './workspace/';
console.log('init task list');

let taskDownload = {};  // 按任务区分的下载队列
let taskStatus = {};  // 任务下载状态等
let stepFile = 100;  // 控制下载节奏

// 打开的文件句柄数目
let numFD = 0;
let maxFD = 400;
// HTTP连接数目
let numReq = 0;
let maxReq = 300;
// 时间间隔
let timeStep = 500;
let timeWait = timeStep * 2;

function showStatus(taskID) {
    console.timeEnd("task-" + taskID);
    console.log("Task " + taskID + " Download Status: ");
    console.log(taskStatus[taskID]);
}

function pushTaskDownload(taskID, p, u) {
    taskDownload[taskID].push(
        {
            "path": p,
            "url": u,
        }
    );
}

function downloadParallel(taskID) {
    // 控制并发量
    if (numFD > maxFD || numReq > maxReq) {
        console.log("Wait... fd: " + numFD + " req: " + numReq);
        setTimeout(function () {
            downloadParallel(taskID);
        }, timeWait);
        return;
    }
    // 本次执行的下载列表
    let listFunction = [];
    let loop = Math.min(taskStatus[taskID].begin + stepFile, taskStatus[taskID].total + taskStatus[taskID].retry);

    while (taskStatus[taskID].begin < loop) {
        let i = taskStatus[taskID].begin;
        listFunction.push(function (callback) {
            numFD += 1;
            let f = fs.createWriteStream(taskDownload[taskID][i].path)
                .on("error", function (err) {
                    // 可能会文件句柄不够, 或者路径无效
                    numFD -= 1;
                    console.log("Open file failed: " + taskDownload[taskID][i].path + "\n" + err);
                    // Todo: 这里的重试好像不起作用
                    taskDownload[taskID].push(taskDownload[taskID][i]);  // 扔到末尾等待重试
                    taskStatus[taskID].retry += 1;
                    taskStatus[taskID].done += 1;
                })
                .on("close", function () {
                    numFD -= 1;
                    taskStatus[taskID].done += 1;
                    if (taskStatus[taskID].done == taskStatus[taskID].total + taskStatus[taskID].retry) {
                        console.log("Task Over: " + taskID);
                        showStatus(taskID);
                        console.log("fd: " + numFD + " req: " + numReq);
                        console.log(delete taskDownload[taskID]);  // 清除已经完成的任务
                    }
                });

            // 需要确保文件夹存在
            // request(listFile[i].url).pipe(fs.createWriteStream(listFile[i].path));
            request
                .get(taskDownload[taskID][i].url, function () {
                    numReq -= 1;
                })
                .on("close", function () {
                    console.log("request has closed");
                })
                .on("error", function (err) {
                    console.log("req[" + i + "]" + err);
                    taskDownload[taskID].push(taskDownload[taskID][i]);  // 扔到末尾等待重试
                    taskStatus[taskID].retry += 1;
                    // 出错会生成空文件, 删除并释放句柄
                    fs.unlink(taskDownload[taskID][i].path, function () {
                        console.log("rm " + taskDownload[taskID][i].path);
                    });
                    f.close();  // 需要手动关闭
                })
                .pipe(f)
                .on("error", function (err) {
                    console.log("pipe err: " + err);
                });
            numReq += 1;

            callback(null, taskStatus[taskID].begin);
        });
        taskStatus[taskID].begin += 1;
    }
    // 由于 request 是异步的, 所以这里的并发限制没啥卵用
    async.parallelLimit(listFunction, 5, function (err, result) {
        // console.log(err);
        // console.log(result);
        showStatus(taskID);
        if (taskStatus[taskID].begin < taskStatus[taskID].total + taskStatus[taskID].retry) {
            setTimeout(function () {
                downloadParallel(taskID);
            }, timeStep);
        }
    });
}

function downloadTask(taskID) {
    console.time("task-" + taskID);
    let urlTask = server + "/dawn/api/downloadtask?task_id=" + taskID;
    request(urlTask, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            let res = JSON.parse(body);
            if (res.code === 0) {
                let dirTask = workspace + taskID + "/";
                if (!fs.existsSync(dirTask)) {
                    fs.mkdirSync(dirTask);
                }
                taskDownload[taskID] = [];
                let arrGlobalFile = res.data.global;
                let dirGlobal = dirTask + "global/";
                if (!fs.existsSync(dirGlobal)) {
                    fs.mkdirSync(dirGlobal);
                }
                for (let k in arrGlobalFile) {
                    if (arrGlobalFile[k] !== null && arrGlobalFile[k] !== "") {
                        pushTaskDownload(taskID, dirGlobal + k + ".db3", arrGlobalFile[k]);
                    }
                }
                let arrMeshFile = res.data.list;
                let numMesh = arrMeshFile.length;

                for (let i = 0; i < numMesh; i++) {
                    let meshID = arrMeshFile[i]["mesh_id"];
                    let dirMesh = dirTask + meshID + "/";
                    if (!fs.existsSync(dirMesh)) {
                        fs.mkdirSync(dirMesh);
                    }
                    pushTaskDownload(taskID, dirMesh + "data.zip", arrMeshFile[i]["data_url"]);
                    // 融合版本
                    if ("master_url" in arrMeshFile[i]) {
                        pushTaskDownload(taskID, dirMesh + "master.zip", arrMeshFile[i]["master_url"]);
                    }
                    if ("before_edit_url" in arrMeshFile[i]) {
                        pushTaskDownload(taskID, dirMesh + "before.zip", arrMeshFile[i]["before_edit_url"]);
                    }
                    if ("after_edit_url" in arrMeshFile[i]) {
                        pushTaskDownload(taskID, dirMesh + "after.zip", arrMeshFile[i]["after_edit_url"]);
                    }
                    // 参考资料
                    let objRefer = arrMeshFile[i]["refer_url"];
                    if ("conflict_url" in objRefer && objRefer["conflict_url"] !== null && objRefer["conflict_url"] !== "") {
                        pushTaskDownload(taskID, dirMesh + "conflict.db3", objRefer["conflict_url"]);
                    }
                    if ("qi" in objRefer && objRefer["qi"] !== null && objRefer["qi"] !== "") {
                        pushTaskDownload(taskID, dirMesh + "conflict.db3", objRefer["conflict_url"]);
                    }

                    if ("exto_pano" in objRefer && objRefer["exto"] !== null) {
                        for (let exto in objRefer["exto_pano"]) {
                            pushTaskDownload(taskID, dirMesh + "exto_" + exto + ".db3", objRefer["exto_pano"][exto]);
                        }
                    }

                }
                // 当 done == total + retry 时, 该任务下载完成
                taskStatus[taskID] = {
                    "total": taskDownload[taskID].length,  // 需要下载的文件数目
                    "begin": 0,  // 已经开始下载的文件数目(包括失败重试)
                    "retry": 0,  // 需要失败重试的数目
                    "done": 0,  // 下载完成的文件数目(包括失败重试)
                };
                downloadParallel(taskID);
            } else {
                console.log(res["msg"]);
            }

        }
    });
}

// 初始化任务列表
function initNewList() {
    let listBtnDownload = document.getElementsByClassName("bt-download");
    let numTaskDownload = listBtnDownload.length;
    for (let i = 0; i < numTaskDownload; i++) {
        // 监听下载按钮
        listBtnDownload[i].addEventListener("click", function (event) {
            let taskID = event.target.id.split("-")[1];
            console.log("download: " + taskID);
            // 从新任务列表删除
            document.getElementById("task-" + taskID).remove();
            // 移入下载列表
            let task = document.createElement("li");
            task.setAttribute("id", "task-" + taskID);
            let html = '<div class="task-id" style="width:60px;float:left">' + taskID + '</div>';
            html += '<button id="ed-' + taskID + '" class="bt-edit">作业</button>';
            html += '<button id="ci-' + taskID + '" class="bt-commit">提交</button>';
            task.innerHTML = html;
            document.getElementById("ul-dl").appendChild(task);
            initLocalList();
            downloadTask(taskID);
        })
    }
}

function initLocalList() {
    // 本地任务列表
    let listBtnCommit = document.getElementsByClassName("bt-commit");
    let numTaskCommit = listBtnCommit.length;
    for (let i = 0; i < numTaskCommit; i++) {
        listBtnCommit[i].addEventListener("click", function (event) {
            let taskID = event.target.id.split("-")[1];
            console.log("commit: " + taskID);
            // 从本地任务列表删除
            document.getElementById("task-" + taskID).remove();
            // 移入提交列表
            let task = document.createElement("li");
            task.setAttribute("id", "task-" + taskID);
            let html = '<div class="task-id" style="width:60px;float:left">' + taskID + '</div>';
            html += '<div style="width:100px;float:left">提交中...</div>';
            task.innerHTML = html;
            document.getElementById("ul-ci").appendChild(task);
        })
    }
}

function init() {
    initNewList();
    initLocalList();
}

let btnRefresh = document.getElementById("btn-refresh");
btnRefresh.addEventListener("click", function () {
    let userID = 321;

    let urlTaskList = server + "/dawn/api/gettasklist?task_status=1|2&user_id=" + userID;
    // 这里是异步的
    request(urlTaskList, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            // console.log(body);
            let res = JSON.parse(body);
            if (res.code === 0) {
                let taskListNew = document.getElementById("ul-new");
                let html = "";
                let numTask = res.data.total;
                let arrTask = res.data.list;
                console.log("task num: " + numTask);

                for (let i = 0; i < numTask; i++) {
                    let taskID = arrTask[i]["task_id"];
                    console.log("task id: " + taskID);
                    html += '<li id="task-' + taskID + '"><div class="task-id" style="width:60px;float:left">' + taskID + '</div>';
                    html += '<button id="dl-' + taskID + '" class="bt-download">下载</button>';
                    html += '</li>';
                }
                taskListNew.innerHTML = html;
                init();
            } else {
                console.log(res["msg"]);
            }

        }
    });

});

init();