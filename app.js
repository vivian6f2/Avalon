//----------------------------------------------------------------------//
//public information for avalon game
//game options
//game necessary count / set
var turn = 0;
var vote_turn = 0;
var success_time = 0;
var fail_time = 0;
var vote_success = 0;
var vote_fail = 0;

//for characters setting
var max_good = 0;
var max_evil = 0;
var good_evil_count = [[3,2],[4,2],[4,3],[5,3],[6,3],[6,4]];
var good_characters = [];
var evil_characters = [];
var all_characters = [];

//for mission sending (number of ppl of team & the 4th mission need 2 fail or not)
var team_assignment = [[[2,3,2,3,3],false],[[2,3,4,3,4],false],[[2,3,3,4,4],true],[[3,4,4,5,5],true],[[3,4,4,5,5],true],[[3,4,4,5,5],true]];
var team_members = [];

//game states
var states = ["wait","randomCharacters","sendMission","vote","mission",
"missionSuccess","missionFail","update","findMerlin","evilWin","goodWin"];
var state = states[0];

//player information
var player_data = []; //id, name, role, ready
var player_id = 0; //for creating unique id
var room_owner_id = null;
var leader_id = null;
//----------------------------------------------------------------------//


//----------------------------------------------------------------------//
//引入程序包
var express = require('express')
  , path = require('path')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

//设置日志级别
io.set('log level', 1); 
//----------------------------------------------------------------------//







//----------------------------------------------------------------------//
//gameplay programming here!!
//WebSocket连接监听
io.on('connection', function (socket) {
  socket.emit('open');//通知客户端已连接 //只傳給一個

  // 打印握手信息
  // console.log(socket.handshake);

  // 构造客户端对象
  var client = {
    socket:socket,
    name:false,
    color:getColor(),
    id:null //same as player_data[index]['id']
  };

//--------------All states are different--------------//
  socket.on('player', function(json){

    switch(state){
      case "wait":

        if(json.type=='setName'){
          //player login
          var obj = {time:getTime(),color:client.color};

          if(player_data.length>=0&&player_data.length<10){

            if(room_owner_id==null) room_owner_id = player_id;
            //tell client they are join
            socket.emit('system',{state:state,type:'join',author:'System',value:true,player_id:player_id,room_owner_id:room_owner_id});
         
            client.name = json.name;
            obj['text']=client.name;
            obj['author']='System';
            obj['type']='welcome';
            obj['state']=state;    


            //add this player into player data
            var one_player_data = {id:player_id,name:client.name,role:null,ready:false,vote:null}; //id & name & character & ready
            client.id = one_player_data['id'];
            client.index = player_data.length;
            player_data.push(one_player_data);
            player_id ++;
            console.log(client.name + " id="+one_player_data['id']);

            //返回欢迎语
            socket.emit('system',obj);
            //广播新用户已登陆
            socket.broadcast.emit('system',obj);

            if(player_data.length>=5){
              socket.emit('system',{state:state,type:'ready',author:'System'});
              socket.broadcast.emit('system',{state:state,type:'ready',author:'System'});
            }


            //update player list
            updatePlayerList();
            //update ready state
            updateAllReadyState();
          }
          else{
            //the server is full!
            obj['text']='Sorry, the server is full';
            obj['author']='System';
            obj['type']='full';
            obj['state']=state;
            socket.emit('system',obj);
            //update player list
            updatePlayerList();
            //update ready state
            updateAllReadyState();
            
          }
        }else if(json.type=='readyButton'){
          //client press ready or not yet
          client_state = json.value;
          var obj={time:getTime(),color:client.color};
          obj['author']='System';
          obj['type']='ready';
          obj['state']=state;
          console.log(client.name +" " + client_state);
          if(client_state=='ready'){
            for(i=0;i<player_data.length;i++){
              if(client.id==player_data[i]['id'])
                player_data[i]['ready']=true;
            }
          }else if(client_state=='notyet'){
            for(i=0;i<player_data.length;i++){
              if(client.id==player_data[i]['id'])
                player_data[i]['ready']=false;
            }
          }
          //update player list
          updatePlayerList();
          //update ready state
          updateAllReadyState();
        }else if(json.type=='playButton'){
          //room owner press play!
          state = states[1];
          //tell client to change state
          changeState();
          setGoodEvil();
          askCharactersSet();
        }

        break;
      case "randomCharacters":
        if(json.type=='ready'){
          good_characters = json.good_characters;
          evil_characters = json.evil_characters;
          console.log('done characters choosing');
          //console.log(good_characters);
          //console.log(evil_characters);

          //random characters to players
          randomSetCharacters();
          console.log(good_characters);
          console.log(evil_characters);
          console.log(all_characters);
          
          state = states[2];
          changeState();

          setLeader();
          //update player list
          updatePlayerList();

        }
        break;
      case "sendMission":
        if(json.type=='ready'){
          team_members = json.team_members;
          console.log('done team members choosing');
          console.log(team_members);
          console.log(vote_turn);

          resetVote();
          if(vote_turn==4){
            state = states[4];
            vote_turn = 0;
            changeState();
            missionVote();
            updatePlayerList();
          }else{
            state = states[3];
            voting();
          }
        }
        break;
      case "vote":
          if(json.type=='vote'){
            console.log(client.id +" : "+ json.value);
            updateVote(json.value);
          }
        break;
      case "mission":
          if(json.type=='vote'){
            updateMissionVote(json.value);
          }
        break;
      case "missionSuccess":
        break;
      case "missionFail":
        break;
      case "update":
        break;
      case "findMerlin":
        if(json.type=='find'){
          var find=false;
          console.log("id is "+json.value);
          for(i=0;i<player_data.length;i++){
            console.log(player_data[i]['role'][0]);
            if(player_data[i]['id']==json.value && player_data[i]['role'][0]=="Merlin"){
              //evil win
              find = true;
            }
          }
          if(find){
            state = states[9];
          }else{
          //good win
            state = states[10];
          }
          console.log("find : "+find);
          changeState();
          socket.emit('system',{state:state,type:'endGame',author:'System'});
          socket.broadcast.emit('system',{state:state,type:'endGame',author:'System'});
          init();
          changeState();
          updatePlayerList();
        }
        break;
      default:
        break;
    }


  });
  

//--------------All states are different--------------//



//--------------All states are same--------------//
    
  //对message事件的监听 only for chatting
  socket.on('message', function(msg){
    var obj = {time:getTime(),color:client.color};
    //如果不是第一次的连接，正常的聊天消息
    obj['text']=msg;
    obj['author']=client.name;      
    obj['type']='message';
    console.log(client.name + ' say: ' + msg);
    // 返回消息（可以省略）
    socket.emit('message',obj);
    // 广播向其他用户发消息
    socket.broadcast.emit('message',obj);
  });


  //监听出退事件
  socket.on('disconnect', function () {  
    var obj = {
      time:getTime(),
      color:client.color,
      author:'System',
      text:client.name,
      type:'disconnect'
    };
    // 广播用户已退出
    //remove this player from player_data

    for(i=0;i<player_data.length;i++){
      if(client.id==player_data[i]['id']){
        player_data.splice(i,1);
      }
    }
    if(client.id==room_owner_id && player_data.length>0)
      room_owner_id = player_data[0]['id'];
    else if(client.id==room_owner_id && player_data.length==0)
      room_owner_id = null;
    
    socket.broadcast.emit('system',obj);
    console.log(client.name + '(' + client.id+ ') Disconnect');
    console.log('total player number: '+player_data.length);


    if(state != "wait"){
      state = states[0];
      for(i=0;i<player_data.length;i++){
        player_data[i]['ready']=false;
        player_data[i]['role']=null;
      }
      changeState();
    }
    if(player_data.length<5){
      //set all ready to false
      socket.emit('system',{state:state,type:'hideReady',author:'System'});
      socket.broadcast.emit('system',{state:state,type:'hideReady',author:'System'});
      for(i=0;i<player_data.length;i++){
        player_data[i]['ready']=false;
        player_data[i]['role']=null;
      }
    }
    //console.log(player_data);
    init();
    //update player list
    updatePlayerList();
    //update ready state
    updateAllReadyState();
  });
//--------------All states are same--------------//
//--------------Function to use here--------------//
//--------------All states--------------//
  var init=function(){
    //initial
    leader_id = null;
    turn = 0;
    vote_turn = 0;
    success_time = 0;
    fail_time = 0;
    max_good = 0;
    max_evil = 0;
    good_characters = [];
    evil_characters = [];
    all_characters = [];
    team_members = [];
    state = states[0];
    vote_fail = 0;
    vote_success = 0;
    resetVote();
    resetPlayerData();
    updateAllReadyState();
  };
  var updatePlayerList=function(){
    //update player list
    updateObj={state:state,type:'playerList',author:'System',room_owner_id:room_owner_id};
    updateObj['playerData']=player_data;
    console.log(updateObj);
    socket.emit('system',updateObj);
    socket.broadcast.emit('system',updateObj);
  };

  var changeState=function(){
    socket.emit('system',{state:state,type:'changeState',author:'System'});
    socket.broadcast.emit('system',{state:state,type:'changeState',author:'System'});
  };
  var resetPlayerData=function(){
    for(i=0;i<player_data.length;i++){
      player_data[i]['role']=null;
      player_data[i]['ready']=false;
      player_data[i]['vote']=null;
    }
  };
//--------------All states--------------//
//--------------wait states--------------//
  var setGoodEvil=function(){
    max_good = good_evil_count[player_data.length-5][0];
    max_evil = good_evil_count[player_data.length-5][1];
  };
  var askCharactersSet=function(){

    console.log('room owner, ask characters set');
    updatePlayerList();
    var ask = {type:'chooseCharactersSet',state:state,author:'System',good:max_good,evil:max_evil};
    socket.emit('system',ask);
  };
  var updateAllReadyState=function(){
    all_ready = true; //check if all the players are ready
    for(i=0;i<player_data.length;i++){
      all_ready = all_ready & player_data[i]['ready'];
    }
    //console.log(all_ready);
    if(all_ready){
      socket.emit('system',{state:state,type:'allReady',author:'System',value:true});
      socket.broadcast.emit('system',{state:state,type:'allReady',author:'System',value:true});
    }else{
      socket.emit('system',{state:state,type:'allReady',author:'System',value:false});
      socket.broadcast.emit('system',{state:state,type:'allReady',author:'System',value:false});

    }
  };
//--------------wait states--------------//
//--------------randomCharacters states--------------//
  var randomSetCharacters=function(){
    while(good_characters.length<max_good){
      good_characters.push('Stupid Good');
    }
    while(evil_characters.length<max_evil){
      evil_characters.push('Stupid Evil');
    }
    //all_characters = good_characters.concat(evil_characters);
    for(i=0;i<good_characters.length;i++){
      all_characters.push([good_characters[i],'Good']);
    }
    for(i=0;i<evil_characters.length;i++){
      all_characters.push([evil_characters[i],'Evil']);
    }
    shuffleArray();
    //console.log(all_characters);
    for(i=0;i<player_data.length;i++){
      player_data[i]['ready']=false;
      player_data[i]['role']=all_characters[i];
    }
    //console.log(player_data);
  };
  var shuffleArray=function(){
    var counter = all_characters.length;
    while(counter>0){
      var index = Math.floor(Math.random()*counter);
      counter--;
      var temp = all_characters[counter];
      all_characters[counter] = all_characters[index];
      all_characters[index] = temp;
    }
  };
//--------------randomCharacters states--------------//
//--------------sendMission states--------------//
  var setLeader=function(){
    if(leader_id==null){
      leader_id = player_data[ Math.floor((Math.random() * player_data.length)) ]['id'];
    }else{
      if(leader_id == player_data[player_data.length-1]['id']){
        leader_id = player_data[0]['id'];
      }else{
        for(i=0;i<player_data.length;i++){
          if(leader_id == player_data[i]['id']){
            leader_id = player_data[i+1]['id'];
            break;
          }
        }
      }
    }
    console.log("set leader, turn: ");
    console.log(turn);
    num_of_team = team_assignment[player_data.length-5][0][turn];
    two_fail = team_assignment[player_data.length-5][1];
    socket.emit('system',{state:state,type:'setLeader',author:'System',leader_id:leader_id,team_size:num_of_team,two_fail:two_fail,turn:turn,vote_turn:vote_turn});
    socket.broadcast.emit('system',{state:state,type:'setLeader',author:'System',leader_id:leader_id,team_size:num_of_team,two_fail:two_fail,turn:turn,vote_turn:vote_turn});
    
  };

  var resetVote=function(){
    for(i=0;i<player_data.length;i++){
      player_data[i]['vote']=null;
    }
  }

//--------------sendMission states--------------//
//--------------vote states--------------//
  var voting=function(){
    socket.emit('system',{state:state,type:'vote',author:'System',team_members:team_members});
    socket.broadcast.emit('system',{state:state,type:'vote',author:'System',team_members:team_members});
  };

  var updateVote=function(value){
    //update vote (true/false) into player_data
    var agree = 0;
    var disagree = 0;
    for(i=0;i<player_data.length;i++){
      if(player_data[i]['id']==client.id){
        player_data[i]['vote']=value;
      }
      if(player_data[i]['vote']==true){
        agree++;
      }else if(player_data[i]['vote']==false){
        disagree++;
      }
    }
    if((agree+disagree)==player_data.length){//if all players have voted
      if(disagree>=agree){
      //if disagree>=agree, back to sendMission state
        vote_turn++;
        state = states[2];
        changeState();
        setLeader();
        //update player list
        updatePlayerList();

      }else if(agree>disagree){
      //if agree>disagree, go to mission state
        vote_turn = 0;
        state = states[4];
        changeState();
        missionVote();
        updatePlayerList();
      }
    }
  }

//--------------vote states--------------//
//--------------mission states--------------//
  var missionVote=function(){
    socket.emit('system',{state:state,type:'vote',author:'System',team_members:team_members});
    socket.broadcast.emit('system',{state:state,type:'vote',author:'System',team_members:team_members}); 
  }
  var updateMissionVote=function(value){
    var two_fail = team_assignment[player_data.length-5][1];
    if(value) vote_success++;
    else vote_fail++;

    if((vote_success+vote_fail)==team_members.length){
      turn++;
      if(turn==4 && two_fail){
        if(vote_fail>=2){
          //fail
          state = states[6];
          fail_time++;

        }else{
          //success
          state = states[5];
          success_time++;

        }
      }else{
        if(vote_fail>=1){
          //fail
          state = states[6];
          fail_time++;

        }else{
          //success
          state = states[5];
          success_time++;

        }
      }
      //console.log(turn);
      //console.log(success_time);
      //console.log(fail_time);
      //console.log(state);
      changeState();
      socket.emit('system',{state:state,type:'update',author:'System',detail:[vote_success,vote_fail,success_time,fail_time]});
      socket.broadcast.emit('system',{state:state,type:'update',author:'System',detail:[vote_success,vote_fail,success_time,fail_time]}); 
      state = states[7];
      changeState();
      updateGame();
    }

      
  }
//--------------mission states--------------//
//--------------update states--------------//
var updateGame=function(){
  //console.log(turn);
  //console.log(vote_turn);
  vote_success = 0;
  vote_fail = 0;
  if(fail_time>=3){//Evil win
    state = states[9];
    changeState();
    socket.emit('system',{state:state,type:'endGame',author:'System'});
    socket.broadcast.emit('system',{state:state,type:'endGame',author:'System'});
    init();
    changeState();
  }else if(success_time>=3){//go into find merlin
    state = states[8];
    changeState();
    var kill_list = [];
    for(i=0;i<player_data.length;i++){
      if(player_data[i]['role'][1]=='Good'){
        kill_list.push([player_data[i]['id'], player_data[i]['name']]);
      }
    }
    console.log(kill_list);
    socket.emit('system',{state:state,type:'kill',kill_list:kill_list});
    socket.broadcast.emit('system',{state:state,type:'kill',kill_list:kill_list});
  }else{
    state = states[2];
    changeState();
    setLeader();
  }
  updatePlayerList();
}
//--------------update states--------------//

//--------------Function to use here--------------//

});
//----------------------------------------------------------------------//









//----------------------------------------------------------------------//
//dont change now
//express基本配置
app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// 指定webscoket的客户端的html文件
app.get('/', function(req, res){
  res.sendfile('views/chat.html');
});

server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});


var getTime=function(){
  var date = new Date();
  return date.getHours()+":"+date.getMinutes()+":"+date.getSeconds();
}

var getColor=function(){
  var colors = ['aliceblue','antiquewhite','aqua','aquamarine','pink','red','green',
                'orange','blue','blueviolet','brown','burlywood','cadetblue'];
  return colors[Math.round(Math.random() * 10000 % colors.length)];
}
//----------------------------------------------------------------------//