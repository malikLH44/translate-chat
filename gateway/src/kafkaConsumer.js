const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'gateway-consumer',
  brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: 'gateway-group' });

async function startConsumer(io) {
  await consumer.connect();
  await consumer.subscribe({ topic: 'chat.messages.translated', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const data = JSON.parse(message.value.toString());
      io.to(data.recipientId).emit('receive_message', data);
      console.log(`Message poussé vers ${data.recipientId} :`, data);
    },
  });

  console.log('Consumer Kafka du gateway connecté (chat.messages.translated)');
}

module.exports = { startConsumer };