const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'gateway',
  brokers: [process.env.KAFKA_BROKER],
});

const producer = kafka.producer();

async function connectProducer() {
  await producer.connect();
  console.log('Producteur Kafka connecté');
}

async function publishMessage(topic, message) {
  await producer.send({
    topic,
    messages: [
      {
        key: message.conversationId,
        value: JSON.stringify(message),
      },
    ],
  });
}

module.exports = { connectProducer, publishMessage };