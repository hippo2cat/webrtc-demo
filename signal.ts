import { createServer } from 'https'
import { readFileSync } from 'fs'
import WebSocket, { Server } from 'ws'
import path from 'path'

class User {
  readonly name: string;
  private _connection: WebSocket;

  get connection() {
    return this._connection
  }

  constructor(name: string, connection: WebSocket) {
    if (!name) {
      throw new Error('invalid username')
    }
    this.name = name
    this._connection = connection
  }
  changeConnection(connection: WebSocket) {
    this._connection = connection
  }
}

class Channel {
  readonly name: string;
  users: User[] = [];
  constructor(name: string, users?: User[]) {
    if (!name) {
      throw new Error('invalid channel name')
    }
    this.name = name
    if (users) {
      this.users = users
    }
  }
  addUser(user: User) {
    const [existUser] = this.users.filter(({ name }) => name === user.name)
    if (existUser) {
      existUser.changeConnection(user.connection)
    } else {
      this.users.push(user)
    }
    return this
  }
  removeUser(username: string) {
    this.users = this.users.filter(({ name }) => name !== username)
  }
}

interface JoinRequest {
  action: 'join',
  data: {
    channel: string,
    username: string
  }
}

interface LeaveRequest {
  action: 'leave',
  data: {
    channel: string,
    username: string
  }
}

interface JoinResponse {
  action: 'user-join',
  data: string
}

interface LeaveResponse {
  action: 'user-leave',
  data: string
}

interface CallRequest {
  action: 'call',
  data: {
    offer: any,
    to: string,
    channel: string,
    from: string
  }
}

interface IceRequest {
  action: 'ice',
  data: {
    ice: any,
    to: string,
    channel: string,
    from: string
  }
}

interface CallResponse {
  action: 'call-response',
  data: {
    offer: any,
    from: string
  }
}

interface AnswerRequest {
  action: 'answer',
  data: {
    answer: any,
    to: string,
    channel: string,
    from: string
  }
}

interface AnswerResponse {
  action: 'answer-response',
  data: {
    answer: any,
    from: string
  }
}

interface IceResponse {
  action: 'receive-ice',
  data: {
    ice: any,
    from: string
  }
}

type WSMessage = JoinRequest | LeaveRequest | CallRequest | AnswerRequest | IceRequest

const channels: Channel[] = []

const wsServer = createServer({
  cert: readFileSync(path.join(__dirname, './server.crt')),
  key: readFileSync(path.join(__dirname, './ca.key')),
})

const wss = new Server({
  server: wsServer
})

wss.on('connection', (ws) => {
  ws.on('message', (messageStr) => {
    const message: WSMessage = JSON.parse(messageStr as string)
    if (message.action === 'join') {
      joinChannelHandler(message, ws)
    }
    if (message.action === 'leave') {
      leaveChannelHandler(message, ws)
    }
    if (message.action === 'call') {
      callChannelHandler(message)
    }
    if (message.action === 'answer') {
      answerChannelHandler(message)
    }
    if (message.action === 'ice') {
      iceHandler(message)
    }
  })
})

function joinChannelHandler(message: JoinRequest, ws: WebSocket) {
  const { username, channel } = message.data
  const [existChannel] = channels.filter(({ name }) => name === channel)
  if (existChannel) {
    const { users } = existChannel
    const [existUser] = users.filter(({ name }) => name === username)
    if (existUser) {
      existUser.changeConnection(ws)
    } else {
      const joinResponse: JoinResponse = {
        action: 'user-join',
        data: username
      }
      existChannel.users.forEach((user) => {
        user.connection.send(JSON.stringify(joinResponse))
      })
      existChannel.addUser(new User(username, ws))
    }
  } else {
    channels.push(new Channel(channel).addUser(new User(username, ws)))
  }
}

function leaveChannelHandler(message: LeaveRequest, ws: WebSocket) {
  const { username, channel } = message.data
  const [targetChannel] = channels.filter(({ name }) => name === channel)
  if (targetChannel) {
    const leaveResponse: LeaveResponse = {
      action: 'user-leave',
      data: username
    }
    targetChannel.removeUser(username)
    targetChannel.users.forEach((user) => {
      user.connection.send(JSON.stringify(leaveResponse))
    })
  }
}

function callChannelHandler(message: CallRequest) {
  const { to, offer, channel, from } = message.data
  const [targetChannel] = channels.filter(({ name }) => name === channel)
  if (targetChannel) {
    const [targetUser] = targetChannel.users.filter(({ name }) => name === to)
    if (targetUser) {
      const callResponse: CallResponse = {
        action: 'call-response',
        data: {
          offer,
          from
        }
      }
      targetUser.connection.send(JSON.stringify(callResponse))
    }
  }
}

function answerChannelHandler(message: AnswerRequest) {
  const { to, answer, channel, from } = message.data
  const [targetChannel] = channels.filter(({ name }) => name === channel)
  if (targetChannel) {
    const [targetUser] = targetChannel.users.filter(({ name }) => name === to)
    if (targetUser) {
      const answerResponse: AnswerResponse = {
        action: 'answer-response',
        data: {
          answer,
          from
        }
      }
      targetUser.connection.send(JSON.stringify(answerResponse))
    }
  }
}

function iceHandler(message: IceRequest) {
  const { to, ice, channel, from } = message.data
  const [targetChannel] = channels.filter(({ name }) => name === channel)
  if (targetChannel) {
    const [targetUser] = targetChannel.users.filter(({ name }) => name === to)
    if (targetUser) {
      const iceResponse: IceResponse = {
        action: 'receive-ice',
        data: {
          ice,
          from
        }
      }
      targetUser.connection.send(JSON.stringify(iceResponse))
    }
  }
}

export default wsServer