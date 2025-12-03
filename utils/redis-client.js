module.exports = {
    initializeRedis: () => console.log('Redis désactivé'),
    getRedisClient: () => null,
    closeRedis: () => console.log('Redis fermé')
};
