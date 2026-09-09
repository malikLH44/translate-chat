const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'translation-worker',
  brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: 'translation-worker-group' });
const producer = kafka.producer();

async function start(onMessage) {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: 'chat.messages.raw', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const data = JSON.parse(message.value.toString());
      await onMessage(data, producer);
    },
  });

  console.log('Consumer et producer Kafka connectés');
}

module.exports = { start };